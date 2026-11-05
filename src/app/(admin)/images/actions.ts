"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/admin";
import { UPLOADS_BUCKET } from "@/lib/buckets";

export type ImageResult = { error: string | null };

// Storage paths look like "<user id>/<timestamp>.<ext>".
const ANY_UPLOAD = /^[0-9a-f-]{36}\/\d+\.(jpeg|png|webp|gif)$/i;

function isOwnUpload(path: string, userId: string) {
  return ANY_UPLOAD.test(path) && path.startsWith(`${userId}/`);
}

// CREATE: the browser uploads the file into the admin's own folder, then calls this.
export async function registerUpload(path: string): Promise<ImageResult> {
  const { user } = await requireSuperadmin();
  if (!isOwnUpload(path, user.id)) {
    return { error: "Invalid upload." };
  }
  revalidatePath("/images");
  return { error: null };
}

// UPDATE: swap an image for a newly uploaded one. Generations using the old image are
// pointed at the new file (a new path, so nobody sees a cached copy of the old one).
export async function replaceImage(oldPath: string, newPath: string): Promise<ImageResult> {
  const { supabase, user } = await requireSuperadmin();
  if (!ANY_UPLOAD.test(oldPath) || !isOwnUpload(newPath, user.id)) {
    return { error: "Invalid image." };
  }

  const { error: updateError } = await supabase
    .from("generations")
    .update({ image_path: newPath })
    .eq("image_path", oldPath);
  if (updateError) {
    await supabase.storage.from(UPLOADS_BUCKET).remove([newPath]);
    return { error: `Couldn't update the generation: ${updateError.message}` };
  }

  const { error: removeError } = await supabase.storage.from(UPLOADS_BUCKET).remove([oldPath]);
  if (removeError) console.error("Removing replaced image failed", removeError);

  revalidatePath("/", "layout");
  return { error: null };
}

// DELETE: only images no generation uses (delete those generations from Media instead).
export async function deleteImage(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const path = String(formData.get("path"));
  if (!ANY_UPLOAD.test(path)) return;

  const { count } = await supabase
    .from("generations")
    .select("id", { count: "exact", head: true })
    .eq("image_path", path);
  if ((count ?? 0) > 0) return;

  const { error } = await supabase.storage.from(UPLOADS_BUCKET).remove([path]);
  if (error) console.error("Deleting image failed", error);
  revalidatePath("/images");
}
