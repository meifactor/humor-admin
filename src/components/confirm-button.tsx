"use client";

import { useFormStatus } from "react-dom";
import { dangerButtonClass } from "@/components/ui";

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
