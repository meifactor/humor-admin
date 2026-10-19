import { AVATAR_BUCKET, UPLOADS_BUCKET } from "@/lib/buckets";
import { getSupabaseEnv } from "@/lib/supabase/env";

function publicUrl(bucket: string, path: string) {
  const { url } = getSupabaseEnv();
  return `${url}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function uploadUrl(path: string) {
  return publicUrl(UPLOADS_BUCKET, path);
}

export function avatarUrl(path: string | null) {
  return path ? publicUrl(AVATAR_BUCKET, path) : null;
}

export function fullName(person: { first_name: string | null; last_name: string | null }) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unnamed user";
}
