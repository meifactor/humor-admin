import type { Metadata } from "next";
import Link from "next/link";
import { LlmResponseCard, type LlmResponse } from "@/components/llm-response-card";
import { secondaryButtonClass } from "@/components/ui";
import { requireSuperadmin } from "@/lib/admin";

export const metadata: Metadata = { title: "LLM responses · Control Center" };

const PAGE_SIZE = 25;

// READ every logged LLM response, newest first.
export default async function ResponsesPage({ searchParams }: PageProps<"/responses">) {
  const { supabase } = await requireSuperadmin();
  const { status: statusParam, page: pageParam } = await searchParams;
  const status = statusParam === "success" || statusParam === "error" ? statusParam : undefined;
  const page = Math.max(1, Number(pageParam) || 1);

  let query = supabase
    .from("llm_responses")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);

  const { data, count, error } = await query.returns<LlmResponse[]>();
  const responses = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (next: { status?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const query = params.toString();
    return query ? `/responses?${query}` : "/responses";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LLM responses</h1>
          <p className="mt-1 text-ink-3">{count ?? 0} calls to the AI, with the exact prompt and response · read-only</p>
        </div>
        <Link href="/requests" className="text-sm font-bold text-ink-2 hover:text-white">
          ← Requests
        </Link>
      </div>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {[
          { value: undefined, label: "All" },
          { value: "success", label: "Successful" },
          { value: "error", label: "Errors" },
        ].map((f) => (
          <Link
            key={f.label}
            href={href({ status: f.value })}
            aria-current={status === f.value ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${
              status === f.value ? "bg-white text-black" : "border border-edge text-ink-2 hover:text-white"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="rounded-md border border-mta-red p-4 text-red-300">Could not load responses: {error.message}</p>
      ) : (
        <div className="space-y-3">
          {responses.map((response) => (
            <LlmResponseCard key={response.id} response={response} showRequestLink />
          ))}
          {responses.length === 0 && <p className="text-ink-3">No LLM responses logged yet.</p>}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={href({ status, page: page - 1 })} className={secondaryButtonClass}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-3">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href({ status, page: page + 1 })} className={secondaryButtonClass}>
              Older →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
