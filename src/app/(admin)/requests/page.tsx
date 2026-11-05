import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/panel";
import { panelClass } from "@/components/ui";
import { requireSuperadmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { formatDuration, StatusBadge } from "@/lib/observability";
import { fullName } from "@/lib/storage";
import { getVibe } from "@/lib/vibes";

export const metadata: Metadata = { title: "Generation requests · Control Center" };

type RequestRow = {
  id: string;
  source: string;
  chain_name: string | null;
  vibe: string | null;
  status: string;
  error: string | null;
  generation_id: string | null;
  created_at: string;
  duration_ms: number | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
  llm_responses: { count: number }[];
};

type ResponseRow = { model_id: string; status: string; latency_ms: number | null };

// READ generation requests, plus how each model has been performing.
export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const { supabase } = await requireSuperadmin();
  const { status: statusParam } = await searchParams;
  const status = ["succeeded", "failed", "pending"].includes(String(statusParam)) ? String(statusParam) : undefined;

  let query = supabase
    .from("generation_requests")
    .select(
      "id, source, chain_name, vibe, status, error, generation_id, created_at, duration_ms, profiles(first_name, last_name), llm_responses(count)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);

  const [{ data, error }, { data: responseData }] = await Promise.all([
    query.returns<RequestRow[]>(),
    supabase
      .from("llm_responses")
      .select("model_id, status, latency_ms")
      .order("created_at", { ascending: false })
      .limit(1000)
      .returns<ResponseRow[]>(),
  ]);
  const requests = data ?? [];

  // Model health over the last 1,000 LLM calls.
  const byModel = new Map<string, { calls: number; ok: number; latency: number }>();
  for (const r of responseData ?? []) {
    const stats = byModel.get(r.model_id) ?? { calls: 0, ok: 0, latency: 0 };
    stats.calls += 1;
    if (r.status === "success") {
      stats.ok += 1;
      stats.latency += r.latency_ms ?? 0;
    }
    byModel.set(r.model_id, stats);
  }
  const models = [...byModel.entries()].sort((a, b) => b[1].calls - a[1].calls);

  const filters = [
    { value: undefined, label: "All" },
    { value: "succeeded", label: "Succeeded" },
    { value: "failed", label: "Failed" },
    { value: "pending", label: "Pending" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Generation requests</h1>
          <p className="mt-1 text-ink-3">Every &quot;generate captions&quot; attempt, newest first. Click one to see each LLM call.</p>
        </div>
        <Link href="/responses" className="text-sm font-bold text-ink-2 hover:text-white">
          All LLM responses →
        </Link>
      </div>

      <Panel title="Model health" subtitle="Last 1,000 LLM calls, including failed fallback attempts">
        {models.length === 0 ? (
          <p className="text-sm text-ink-3">No LLM calls logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-ink-2">
                <tr className="[&_th]:py-2 [&_th]:pr-4">
                  <th>Model</th>
                  <th className="text-right">Calls</th>
                  <th className="text-right">Success rate</th>
                  <th className="text-right">Avg. time when successful</th>
                </tr>
              </thead>
              <tbody>
                {models.map(([model, stats]) => (
                  <tr key={model} className="border-t border-edge [&_td]:py-2 [&_td]:pr-4">
                    <td>
                      <code className="text-ink-2">{model}</code>
                    </td>
                    <td className="text-right tabular-nums">{stats.calls}</td>
                    <td className="text-right font-bold tabular-nums">{Math.round((stats.ok / stats.calls) * 100)}%</td>
                    <td className="text-right tabular-nums">{stats.ok ? formatDuration(Math.round(stats.latency / stats.ok)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/requests?status=${f.value}` : "/requests"}
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
        <p className="rounded-md border border-mta-red p-4 text-red-300">
          Could not load requests: {error.message}. Has <code>supabase/observability.sql</code> been run?
        </p>
      ) : (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-panel-2 text-ink-2">
              <tr className="[&_th]:px-4 [&_th]:py-2.5">
                <th>When</th>
                <th>Status</th>
                <th>By</th>
                <th>Chain</th>
                <th>Vibe</th>
                <th className="text-right">LLM calls</th>
                <th className="text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-edge hover:bg-panel-2 [&_td]:px-4 [&_td]:py-3">
                  <td className="whitespace-nowrap">
                    <Link href={`/requests/${r.id}`} className="font-bold hover:underline">
                      {formatDateTime(r.created_at)}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap text-ink-2">
                    {r.profiles ? fullName(r.profiles) : "—"}
                    {r.source === "admin" && <span className="ml-1 text-xs text-mta-orange">(admin)</span>}
                  </td>
                  <td className="text-ink-2">{r.chain_name ?? "—"}</td>
                  <td className="whitespace-nowrap text-ink-2">{r.vibe ? `${getVibe(r.vibe).emoji} ${getVibe(r.vibe).label}` : "—"}</td>
                  <td className="text-right tabular-nums">{r.llm_responses[0]?.count ?? 0}</td>
                  <td className="text-right tabular-nums">{formatDuration(r.duration_ms)}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-ink-3">
                    No requests yet. They&apos;re logged every time someone generates captions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
