"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { UPLOADS_BUCKET } from "@/lib/buckets";
import { createClient } from "@/lib/supabase/client";
import { registerUpload, replaceImage } from "./actions";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Uploads a new image, or replaces `replacePath` with the chosen file.
export function ImageUpload({ userId, replacePath }: { userId: string; replacePath?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Choose a JPEG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Choose an image under 10 MB.");
      return;
    }

    setBusy(true);
    setError(null);
    const path = `${userId}/${Date.now()}.${file.type.split("/")[1]}`;
    const { error: uploadError } = await createClient()
      .storage.from(UPLOADS_BUCKET)
      .upload(path, file, { contentType: file.type });

    const result = uploadError
      ? { error: `Upload failed: ${uploadError.message}` }
      : replacePath
        ? await replaceImage(replacePath, path)
        : await registerUpload(path);

    setBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      <label
        className={`${replacePath ? `${secondaryButtonClass} px-3 py-1` : primaryButtonClass} cursor-pointer has-[:disabled]:cursor-default has-[:disabled]:opacity-60`}
      >
        {busy ? "Uploading…" : replacePath ? "Replace" : "+ Upload image"}
        <input type="file" accept={ALLOWED_TYPES.join(",")} onChange={handleChange} disabled={busy} className="sr-only" />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
