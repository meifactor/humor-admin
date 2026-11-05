import Link from "next/link";
import { panelClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { formatDuration, StatusBadge } from "@/lib/observability";

export type LlmResponse = {
  id: string;
  request_id: string;
  step_position: number | null;
  step_name: string | null;
  provider_slug: string | null;
  model_id: string;
  status: string;
  http_status: number | null;
  prompt: string;
  response_text: string | null;
  error: string | null;
  latency_ms: number | null;
  created_at: string;
};

// One LLM call: which step and model, how it went, and the exact prompt and response.
export function LlmResponseCard({ response, showRequestLink = false }: { response: LlmResponse; showRequestLink?: boolean }) {
  return (
    <article className={`${panelClass} p-4`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <StatusBadge status={response.status} />
        {response.step_position !== null && (
          <span className="font-bold">
            Step {response.step_position}
            {response.step_name && `: ${response.step_name}`}
          </span>
        )}
        <code className="text-ink-2">{response.model_id}</code>
        {response.http_status !== null && <span className="text-ink-3">HTTP {response.http_status}</span>}
        <span className="text-ink-3">{formatDuration(response.latency_ms)}</span>
        <span className="ml-auto text-xs text-ink-3">{formatDateTime(response.created_at)}</span>
      </div>

      {response.error && <p className="mt-2 font-mono text-xs break-words text-red-300">{response.error}</p>}

      <div className="mt-3 grid gap-2 text-sm">
        {response.response_text && (
          <details open={!showRequestLink}>
            <summary className="cursor-pointer font-bold text-ink-2 hover:text-white">Response</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded bg-background p-3 font-mono text-xs whitespace-pre-wrap text-ink-2">
              {response.response_text}
            </pre>
          </details>
        )}
        <details>
          <summary className="cursor-pointer font-bold text-ink-2 hover:text-white">Prompt sent</summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded bg-background p-3 font-mono text-xs whitespace-pre-wrap text-ink-2">
            {response.prompt}
          </pre>
        </details>
      </div>

      {showRequestLink && (
        <Link href={`/requests/${response.request_id}`} className="mt-3 inline-block text-sm font-bold text-ink-2 hover:text-white">
          View request →
        </Link>
      )}
    </article>
  );
}
