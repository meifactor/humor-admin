"use client";

import Image from "next/image";
import { useEffect, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { inputClass, primaryButtonClass } from "@/components/ui";
import { UPLOADS_BUCKET } from "@/lib/buckets";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_VIBE, VIBES, type VibeId } from "@/lib/vibes";
import { createGeneration } from "../actions";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_CONTEXT_LENGTH = 200;

export function CreateForm({ userId }: { userId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [vibe, setVibe] = useState<VibeId>(DEFAULT_VIBE);
  const [step, setStep] = useState<"idle" | "uploading" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const busy = step !== "idle";

  // Free the preview's memory when it's replaced or the page is left.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.currentTarget.files?.[0] ?? null;
    setError(null);

    if (chosen && !ALLOWED_TYPES.includes(chosen.type)) {
      setError("Please choose a JPEG, PNG, WebP or GIF image.");
      return;
    }
    if (chosen && chosen.size > MAX_BYTES) {
      setError("Please choose an image under 10 MB.");
      return;
    }

    setFile(chosen);
    setPreviewUrl(chosen ? URL.createObjectURL(chosen) : null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a photo first.");
      return;
    }

    setError(null);
    setStep("uploading");

    // The photo goes straight to Supabase Storage; only its path is sent to the server.
    const extension = file.type.split("/")[1];
    const path = `${userId}/${Date.now()}.${extension}`;
    const { error: uploadError } = await createClient()
      .storage.from(UPLOADS_BUCKET)
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setStep("idle");
      return;
    }

    setStep("generating");
    startTransition(async () => {
      // On success the action redirects to the new photo's page.
      const result = await createGeneration(path, context, vibe);
      if (result?.status === "error") {
        setError(result.message ?? "Something went wrong.");
        setStep("idle");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h2 className="mb-2 font-bold">1. Pick a photo</h2>
        <label className="block cursor-pointer overflow-hidden rounded-md border-2 border-dashed border-edge bg-panel text-center transition hover:border-solid has-[:disabled]:cursor-default">
          {previewUrl ? (
            <div className="relative aspect-[4/3] w-full bg-black">
              <Image src={previewUrl} alt="Your photo" fill unoptimized className="object-contain" />
            </div>
          ) : (
            <div className="px-6 py-14">
              <p className="text-4xl" aria-hidden>
                📸
              </p>
              <p className="mt-2 text-lg font-bold">Choose a photo</p>
              <p className="mt-1 text-sm text-ink-3">JPEG, PNG, WebP or GIF, up to 10 MB</p>
            </div>
          )}
          <input
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            onChange={handleFileChange}
            disabled={busy}
            className="sr-only"
          />
        </label>
        {previewUrl && !busy && (
          <p className="mt-2 text-center text-sm text-ink-3">Click the photo to pick a different one.</p>
        )}
      </div>

      <fieldset disabled={busy}>
        <legend className="mb-2 font-bold">2. Pick a caption vibe</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {VIBES.map((v) => {
            const selected = vibe === v.id;
            return (
              <label
                key={v.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border-2 border-edge bg-panel p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2"
                style={{
                  borderColor: selected ? v.color : undefined,
                  boxShadow: selected ? `inset 6px 0 0 ${v.color}` : undefined,
                }}
              >
                <input
                  type="radio"
                  name="vibe"
                  value={v.id}
                  checked={selected}
                  onChange={() => setVibe(v.id)}
                  className="sr-only"
                />
                <span className="pl-1 text-2xl" aria-hidden>
                  {v.emoji}
                </span>
                <span>
                  <span className="block font-bold">{v.label}</span>
                  <span className="block text-sm text-ink-3">{v.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block font-bold">
        3. What&apos;s happening? <span className="font-normal text-ink-3">(optional)</span>
        <input
          value={context}
          onChange={(event) => setContext(event.target.value)}
          maxLength={MAX_CONTEXT_LENGTH}
          disabled={busy}
          placeholder="e.g. the 1 train at 8am before my midterm"
          className={`${inputClass} font-normal`}
        />
      </label>

      <button type="submit" disabled={busy || !file} className={`${primaryButtonClass} w-full py-3`}>
        {step === "uploading"
          ? "Uploading photo…"
          : step === "generating"
            ? "Writing captions… (can take up to a minute)"
            : "Generate captions"}
      </button>

      {error && (
        <p role="alert" className="rounded-md border-2 border-mta-red p-3 text-sm font-medium text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
