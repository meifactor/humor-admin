import "server-only";
import { ApiError, createPartFromBase64, GoogleGenAI } from "@google/genai";
import { getVibe, type VibeId } from "@/lib/vibes";

export const CAPTION_COUNT = 5;
const MAX_CAPTION_LENGTH = 300;

export function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-flash-latest";
}

// Tried in order when a model has a server error (5xx), is rate limited (429), retired (404),
// times out or the network fails. Bad requests (other 4xx errors) aren't retried.
// Each model has its own free-tier daily quota, so falling back also spreads usage.
const FALLBACK_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.7-flash",
  "gemini-flash-lite-latest",
];
// One time budget for the whole chain (the create page allows 120 seconds), so a slow
// but working model gets time to finish instead of being cut off early.
const TOTAL_BUDGET_MS = 100_000;
const MAX_ATTEMPT_MS = 45_000;
const MIN_ATTEMPT_MS = 10_000;

function shouldTryNextModel(error: unknown) {
  return !(error instanceof ApiError) || error.status >= 500 || [404, 429].includes(error.status);
}

// The full prompt is saved with each generation, so keep it deterministic.
export function buildCaptionPrompt(context: string | null, vibeId: VibeId) {
  const vibe = getVibe(vibeId);
  const lines = [
    "You write captions for a humor app used by Columbia University students in New York City.",
    "The audience is college students who are very online, many of them new to NYC, living in the dorms and exploring the city on weekends.",
    `Write ${CAPTION_COUNT} different funny captions for the attached photo.`,
    "",
    "Rules:",
    "- Each caption is a single line under 120 characters, like a meme caption or a post.",
    `- Style (${vibe.label}): ${vibe.instructions}`,
    "- Make the captions different from each other, not variations of one joke.",
    "- Base the humor on what is actually in the photo.",
    "- Keep it playful: no insults about anyone's appearance, race, religion, gender, sexuality or disability, no slurs, nothing sexual.",
    "- No hashtags. Only use an emoji if it is part of the joke.",
  ];

  if (context) {
    lines.push("", `The person who uploaded the photo added this context: "${context}"`);
  }

  return lines.join("\n");
}

// Ask for exactly CAPTION_COUNT captions as JSON.
const CAPTION_CONFIG = {
  responseMimeType: "application/json",
  responseJsonSchema: {
    type: "object",
    properties: {
      captions: {
        type: "array",
        items: { type: "string" },
        minItems: CAPTION_COUNT,
        maxItems: CAPTION_COUNT,
      },
    },
    required: ["captions"],
  },
};

export async function generateCaptions(
  image: { base64: string; mimeType: string },
  prompt: string,
) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const ai = new GoogleGenAI({ apiKey });
  const models = [getGeminiModel(), ...FALLBACK_MODELS.filter((m) => m !== getGeminiModel())];
  const request = (model: string, timeout: number) =>
    ai.models.generateContent({
      model,
      contents: [createPartFromBase64(image.base64, image.mimeType), prompt],
      config: {
        ...CAPTION_CONFIG,
        // No built-in retries: falling back to the next model is quicker.
        httpOptions: { timeout, retryOptions: { attempts: 1 } },
      },
    });

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let response: Awaited<ReturnType<typeof request>> | undefined;
  for (const [index, model] of models.entries()) {
    const timeout = Math.min(MAX_ATTEMPT_MS, deadline - Date.now());
    const isLast = index === models.length - 1 || timeout < MIN_ATTEMPT_MS;
    const started = Date.now();
    try {
      response = await request(model, timeout);
      break;
    } catch (error) {
      const status = error instanceof ApiError ? error.status : "no status";
      console.warn(`Gemini model ${model} failed (${status}) after ${Date.now() - started}ms`);
      if (!shouldTryNextModel(error) || isLast || deadline - Date.now() < MIN_ATTEMPT_MS) {
        throw error;
      }
    }
  }
  if (!response) {
    throw new Error("Gemini returned no response");
  }

  const parsed: unknown = JSON.parse(response.text ?? "{}");
  const raw =
    parsed && typeof parsed === "object" && "captions" in parsed
      ? (parsed as { captions: unknown }).captions
      : null;

  const captions = (Array.isArray(raw) ? raw : [])
    .filter((caption): caption is string => typeof caption === "string")
    .map((caption) => caption.trim().slice(0, MAX_CAPTION_LENGTH))
    .filter(Boolean)
    .slice(0, CAPTION_COUNT);

  if (captions.length === 0) {
    throw new Error("Gemini returned no captions");
  }

  // The exact model version that answered (the configured name may be an alias).
  return { captions, model: response.modelVersion ?? getGeminiModel() };
}
