import "server-only";
import { ApiError, createPartFromBase64, GoogleGenAI } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getVibe, type VibeId } from "@/lib/vibes";

// Writes captions for a photo by running a prompt chain from the database (prompt_chains,
// prompt_chain_steps, prompt_chain_mix), using the models in llm_models, and logging the
// attempt to generation_requests and every LLM call to llm_responses.
// Keep this file in sync between humor-project and humor-admin.

export const CAPTION_COUNT = 5;
const MAX_CAPTION_LENGTH = 300;

// One time budget for the whole chain (callers allow 120 seconds of server time).
const TOTAL_BUDGET_MS = 100_000;
const MIN_ATTEMPT_MS = 10_000;

type Step = {
  position: number;
  name: string;
  template: string;
  output_format: "text" | "captions";
  uses_image: boolean;
};

type Chain = { id: string | null; name: string; weight: number; steps: Step[] };

type Model = { model_id: string; timeout_ms: number; provider_slug: string };

// Used only if the config tables are empty or can't be read.
const DEFAULT_MODELS: Model[] = [
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
].map((model_id) => ({ model_id, timeout_ms: 45_000, provider_slug: "google" }));

const DEFAULT_CHAIN: Chain = {
  id: null,
  name: "Built-in one-shot caption",
  weight: 1,
  steps: [
    {
      position: 1,
      name: "Write captions",
      output_format: "captions",
      uses_image: true,
      template: [
        "You write captions for a humor app used by Columbia University students in New York City.",
        "Write {{caption_count}} different funny captions for the attached photo.",
        "{{context}}",
        "Each caption is a single line under 120 characters. Style ({{vibe_label}}): {{vibe_instructions}}",
        "Keep it playful: no insults about anyone's appearance or identity, no slurs, nothing sexual. No hashtags.",
      ].join("\n"),
    },
  ],
};

// Ask for exactly CAPTION_COUNT captions as JSON.
const CAPTIONS_SCHEMA = {
  type: "object",
  properties: {
    captions: { type: "array", items: { type: "string" }, minItems: CAPTION_COUNT, maxItems: CAPTION_COUNT },
  },
  required: ["captions"],
};

type PipelineConfig = {
  chains: Chain[];
  models: Model[];
  terms: { term: string; definition: string }[];
  examples: { vibe: string | null; scene: string; caption: string }[];
};

async function loadConfig(db: SupabaseClient): Promise<PipelineConfig> {
  const [chains, models, terms, examples] = await Promise.all([
    db
      .from("prompt_chains")
      .select("id, name, prompt_chain_mix(weight), prompt_chain_steps(position, name, template, output_format, uses_image)")
      .eq("is_active", true),
    db
      .from("llm_models")
      .select("model_id, timeout_ms, priority, llm_providers!inner(slug, is_active)")
      .eq("is_active", true)
      .eq("llm_providers.is_active", true)
      .order("priority", { ascending: true }),
    db.from("terms").select("term, definition").eq("is_active", true).order("term").limit(40),
    db.from("generation_examples").select("vibe, scene, caption").eq("is_active", true),
  ]);

  type ChainRow = {
    id: string;
    name: string;
    prompt_chain_mix: { weight: number } | null;
    prompt_chain_steps: Step[];
  };
  type ModelRow = { model_id: string; timeout_ms: number; llm_providers: { slug: string } | null };

  const loadedChains = ((chains.data as ChainRow[] | null) ?? [])
    .map((c) => ({
      id: c.id,
      name: c.name,
      weight: c.prompt_chain_mix?.weight ?? 0,
      steps: [...c.prompt_chain_steps].sort((a, b) => a.position - b.position),
    }))
    // A usable chain has a weight and ends with a step that writes captions.
    .filter((c) => c.weight > 0 && c.steps.at(-1)?.output_format === "captions");

  // The pipeline only knows how to call Google's Gemini API.
  const loadedModels = ((models.data as ModelRow[] | null) ?? [])
    .filter((m) => m.llm_providers?.slug === "google")
    .map((m) => ({ model_id: m.model_id, timeout_ms: m.timeout_ms, provider_slug: "google" }));

  for (const result of [chains, models, terms, examples]) {
    if (result.error) console.error("Loading caption pipeline config failed", result.error);
  }

  return {
    chains: loadedChains.length ? loadedChains : [DEFAULT_CHAIN],
    models: loadedModels.length ? loadedModels : DEFAULT_MODELS,
    terms: terms.data ?? [],
    examples: examples.data ?? [],
  };
}

// Pick a chain at random, in proportion to its mix weight.
function pickChain(chains: Chain[]) {
  const total = chains.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const chain of chains) {
    roll -= chain.weight;
    if (roll < 0) return chain;
  }
  return chains[0];
}

function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match).trim();
}

function parseCaptions(text: string) {
  const parsed: unknown = JSON.parse(text || "{}");
  const raw = parsed && typeof parsed === "object" && "captions" in parsed ? parsed.captions : null;
  const captions = (Array.isArray(raw) ? raw : [])
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.trim().slice(0, MAX_CAPTION_LENGTH))
    .filter(Boolean)
    .slice(0, CAPTION_COUNT);
  if (captions.length === 0) {
    throw new Error("The model returned no captions");
  }
  return captions;
}

// Try the next model on server errors (5xx), rate limits (429), retired models (404),
// timeouts and network failures. Other 4xx errors are bad requests and won't improve.
function shouldTryNextModel(error: unknown) {
  return !(error instanceof ApiError) || error.status >= 500 || [404, 429].includes(error.status);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 2000) : String(error);
}

export class CaptionPipelineError extends Error {
  readonly requestId: string | null;

  constructor(message: string, requestId: string | null) {
    super(message);
    this.requestId = requestId;
  }
}

type RunOptions = {
  // Supabase client that can read the config and write the logs: the service role in the
  // main app, a superadmin's session in the admin area.
  db: SupabaseClient;
  image: { base64: string; mimeType: string };
  vibe: VibeId;
  context: string | null;
  userId: string;
  imagePath: string;
  source: "app" | "admin";
};

export async function runCaptionPipeline({ db, image, vibe, context, userId, imagePath, source }: RunOptions) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new CaptionPipelineError("Missing GEMINI_API_KEY environment variable", null);
  }

  const config = await loadConfig(db);
  const chain = pickChain(config.chains);
  const started = Date.now();
  const deadline = started + TOTAL_BUDGET_MS;

  const { data: request, error: requestError } = await db
    .from("generation_requests")
    .insert({ user_id: userId, source, chain_id: chain.id, chain_name: chain.name, vibe, image_path: imagePath, context })
    .select("id")
    .single<{ id: string }>();
  if (requestError) console.error("Logging generation request failed", requestError);
  const requestId = request?.id ?? null;

  const vibeInfo = getVibe(vibe);
  const vars: Record<string, string> = {
    caption_count: String(CAPTION_COUNT),
    vibe_label: vibeInfo.label,
    vibe_instructions: vibeInfo.instructions,
    context: context ? `The person who uploaded the photo added this context: "${context}"` : "",
    terms: config.terms.map((t) => `- ${t.term}: ${t.definition}`).join("\n") || "(none)",
    examples:
      config.examples
        .filter((e) => e.vibe === vibe || e.vibe === null)
        .slice(0, 4)
        .map((e) => `- Photo: ${e.scene}\n  Caption: ${e.caption}`)
        .join("\n") || "(none)",
    previous_output: "",
  };

  const ai = new GoogleGenAI({ apiKey });
  const prompts: string[] = [];
  let captions: string[] | null = null;
  let finalModel = "";

  try {
    for (const step of chain.steps) {
      const prompt = render(step.template, vars);
      prompts.push(`## Step ${step.position}: ${step.name}\n${prompt}`);
      const output = await runStep({ ai, db, requestId, step, prompt, image, models: config.models, deadline });
      finalModel = output.model;

      if (step.output_format === "captions") {
        captions = parseCaptions(output.text);
      } else {
        vars.previous_output = output.text.trim();
      }
    }
    if (!captions) {
      throw new Error("The prompt chain's last step didn't produce captions");
    }
  } catch (error) {
    await finishRequest(db, requestId, started, { status: "failed", error: errorMessage(error) });
    throw new CaptionPipelineError(errorMessage(error), requestId);
  }

  return { captions, model: finalModel, prompt: prompts.join("\n\n"), requestId, started };
}

async function runStep({
  ai,
  db,
  requestId,
  step,
  prompt,
  image,
  models,
  deadline,
}: {
  ai: GoogleGenAI;
  db: SupabaseClient;
  requestId: string | null;
  step: Step;
  prompt: string;
  image: { base64: string; mimeType: string };
  models: Model[];
  deadline: number;
}) {
  const contents = step.uses_image ? [createPartFromBase64(image.base64, image.mimeType), prompt] : [prompt];
  const config =
    step.output_format === "captions"
      ? { responseMimeType: "application/json", responseJsonSchema: CAPTIONS_SCHEMA }
      : {};

  let lastError: unknown = new Error("No models are configured");
  for (const model of models) {
    const timeout = Math.min(model.timeout_ms, deadline - Date.now());
    if (timeout < MIN_ATTEMPT_MS) break;

    const attemptStarted = Date.now();
    try {
      const response = await ai.models.generateContent({
        model: model.model_id,
        contents,
        // No built-in retries: falling back to the next model is quicker.
        config: { ...config, httpOptions: { timeout, retryOptions: { attempts: 1 } } },
      });
      const text = response.text ?? "";
      await logResponse(db, {
        request_id: requestId,
        step_position: step.position,
        step_name: step.name,
        provider_slug: model.provider_slug,
        model_id: response.modelVersion ?? model.model_id,
        status: "success",
        http_status: 200,
        prompt,
        response_text: text,
        latency_ms: Date.now() - attemptStarted,
      });
      return { text, model: response.modelVersion ?? model.model_id };
    } catch (error) {
      lastError = error;
      await logResponse(db, {
        request_id: requestId,
        step_position: step.position,
        step_name: step.name,
        provider_slug: model.provider_slug,
        model_id: model.model_id,
        status: "error",
        http_status: error instanceof ApiError ? error.status : null,
        prompt,
        error: errorMessage(error),
        latency_ms: Date.now() - attemptStarted,
      });
      if (!shouldTryNextModel(error)) break;
    }
  }
  throw lastError;
}

async function logResponse(db: SupabaseClient, row: Record<string, unknown>) {
  if (!row.request_id) return;
  const { error } = await db.from("llm_responses").insert(row);
  if (error) console.error("Logging LLM response failed", error);
}

// Record how the request ended (call with the new generation's id once it's saved).
export async function finishRequest(
  db: SupabaseClient,
  requestId: string | null,
  started: number,
  result: { status: "succeeded"; generationId: string } | { status: "failed"; error: string },
) {
  if (!requestId) return;
  const { error } = await db
    .from("generation_requests")
    .update({
      status: result.status,
      error: result.status === "failed" ? result.error : null,
      generation_id: result.status === "succeeded" ? result.generationId : null,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - started,
    })
    .eq("id", requestId);
  if (error) console.error("Updating generation request failed", error);
}
