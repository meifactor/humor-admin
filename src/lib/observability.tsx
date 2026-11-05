// Shared display helpers for generation requests and LLM responses.

export const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  succeeded: { label: "✓ Succeeded", className: "border-green-500 text-green-400" },
  success: { label: "✓ Success", className: "border-green-500 text-green-400" },
  failed: { label: "✕ Failed", className: "border-mta-red text-red-300" },
  error: { label: "✕ Error", className: "border-mta-red text-red-300" },
  pending: { label: "… Pending", className: "border-edge text-ink-2" },
};

export function formatDuration(ms: number | null) {
  if (ms === null || ms === undefined) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { label: status, className: "border-edge text-ink-2" };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-bold whitespace-nowrap ${style.className}`}>
      {style.label}
    </span>
  );
}
