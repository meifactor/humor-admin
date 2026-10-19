"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { dangerButtonClass, inputClass, labelClass, secondaryButtonClass } from "@/components/ui";
import { VIBES } from "@/lib/vibes";
import { updateCaption, updateGeneration, type FormState } from "../actions";

function StatusMessage({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-red-300" : "text-sm text-green-400"}>
      {state.message}
    </p>
  );
}

export function GenerationForm({ id, context, vibe }: { id: string; context: string | null; vibe: string }) {
  const [state, formAction, pending] = useActionState(updateGeneration, { status: "idle" });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <label className={labelClass}>
        Context note
        <input name="context" defaultValue={context ?? ""} maxLength={200} placeholder="No context" className={inputClass} />
      </label>
      <label className={labelClass}>
        Vibe
        <select name="vibe" defaultValue={vibe} className={inputClass}>
          {VIBES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.emoji} {v.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          {pending ? "Saving…" : "Save details"}
        </button>
        <StatusMessage state={state} />
      </div>
    </form>
  );
}

export function CaptionEditor({ id, text }: { id: string; text: string }) {
  const [state, formAction, pending] = useActionState(updateCaption, { status: "idle" });

  return (
    <form action={formAction} className="flex-1 space-y-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`caption-${id}`}>
        Caption text
      </label>
      <textarea
        id={`caption-${id}`}
        name="text"
        defaultValue={text}
        required
        maxLength={300}
        rows={2}
        className={`${inputClass} mt-0 resize-y`}
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={`${secondaryButtonClass} px-3 py-1`}>
          {pending ? "Saving…" : "Save"}
        </button>
        <StatusMessage state={state} />
      </div>
    </form>
  );
}

// A submit button that asks for confirmation first.
export function ConfirmButton({ label, confirmText, compact = false }: { label: string; confirmText: string; compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
      className={`${dangerButtonClass} ${compact ? "px-3 py-1" : ""}`}
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}
