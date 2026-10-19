"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/admin";
import { UPLOADS_BUCKET } from "@/lib/buckets";
import { buildCaptionPrompt, generateCaptions } from "@/lib/gemini";
import { isVibeId } from "@/lib/vibes";

export type FormState = { status: "idle" | "success" | "error"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CONTEXT_LENGTH = 200;
const MAX_CAPTION_LENGTH = 300;
const MIME_TYPES: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function readString(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

// CREATE: caption an uploaded photo with Gemini, saved under the admin's account.
export async function createGeneration(path: string, rawContext: string, vibe: string): Promise<FormState> {
  const { supabase, user } = await requireSuperadmin();

  const match = path.match(new RegExp(`^${user.id}/\\d+\\.(jpeg|png|webp|gif)$`));
  if (!match) {
    return { status: "error", message: "Invalid photo. Please upload it again." };
  }
  const removeUpload = () => supabase.storage.from(UPLOADS_BUCKET).remove([path]);

  if (!isVibeId(vibe)) {
    await removeUpload();
    return { status: "error", message: "Please pick a caption vibe." };
  }
  const context = rawContext.trim().slice(0, MAX_CONTEXT_LENGTH) || null;

  const { data: file, error: downloadError } = await supabase.storage.from(UPLOADS_BUCKET).download(path);
  if (downloadError || !file) {
    return { status: "error", message: "We couldn't read the photo. Please upload it again." };
  }

  const prompt = buildCaptionPrompt(context, vibe);
  let result: Awaited<ReturnType<typeof generateCaptions>>;
  try {
    result = await generateCaptions(
      { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mimeType: MIME_TYPES[match[1]] },
      prompt,
    );
  } catch (error) {
    console.error("Caption generation failed", error);
    await removeUpload();
    return { status: "error", message: "Gemini is busy or out of free quota. Please try again in a minute." };
  }

  // Superadmins may insert generations and captions directly (RLS policies in admin.sql).
  const { data: generation, error: generationError } = await supabase
    .from("generations")
    .insert({ user_id: user.id, image_path: path, context, vibe, prompt, model: result.model })
    .select("id")
    .single<{ id: string }>();

  if (generationError || !generation) {
    console.error("Saving generation failed", generationError);
    await removeUpload();
    return { status: "error", message: "Couldn't save the generation." };
  }

  const { error: captionsError } = await supabase
    .from("captions")
    .insert(result.captions.map((text, position) => ({ generation_id: generation.id, text, position })));

  if (captionsError) {
    console.error("Saving captions failed", captionsError);
    await supabase.from("generations").delete().eq("id", generation.id);
    await removeUpload();
    return { status: "error", message: "Couldn't save the captions." };
  }

  revalidatePath("/", "layout");
  redirect(`/media/${generation.id}`);
}

// UPDATE: a generation's context note and vibe label.
export async function updateGeneration(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  const id = readString(formData, "id");
  const vibe = readString(formData, "vibe");
  const context = readString(formData, "context").slice(0, MAX_CONTEXT_LENGTH) || null;

  if (!UUID.test(id) || !isVibeId(vibe)) {
    return { status: "error", message: "Invalid details." };
  }

  const { error } = await supabase.from("generations").update({ context, vibe }).eq("id", id);
  if (error) {
    return { status: "error", message: `Couldn't save: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Saved." };
}

// UPDATE: a caption's text.
export async function updateCaption(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireSuperadmin();
  const id = readString(formData, "id");
  const text = readString(formData, "text");

  if (!UUID.test(id)) {
    return { status: "error", message: "Invalid caption." };
  }
  if (!text || text.length > MAX_CAPTION_LENGTH) {
    return { status: "error", message: `Captions must be 1–${MAX_CAPTION_LENGTH} characters.` };
  }

  const { error } = await supabase.from("captions").update({ text }).eq("id", id);
  if (error) {
    return { status: "error", message: `Couldn't save: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Saved." };
}

// DELETE: one caption (its reactions are removed by cascade).
export async function deleteCaption(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const id = readString(formData, "id");
  if (UUID.test(id)) {
    await supabase.from("captions").delete().eq("id", id);
  }
  revalidatePath("/", "layout");
}

// DELETE: a whole generation, its captions and reactions (cascade), and its photo file.
export async function deleteGeneration(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const id = readString(formData, "id");
  if (!UUID.test(id)) {
    return;
  }

  const { data: deleted } = await supabase
    .from("generations")
    .delete()
    .eq("id", id)
    .select("image_path")
    .maybeSingle<{ image_path: string }>();

  if (deleted) {
    await supabase.storage.from(UPLOADS_BUCKET).remove([deleted.image_path]);
  }

  revalidatePath("/", "layout");
  redirect("/media");
}
