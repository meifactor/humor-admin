import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LlmResponseCard, type LlmResponse } from "@/components/llm-response-card";
import { panelClass } from "@/components/ui";
import { requireSuperadmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { formatDuration, StatusBadge } from "@/lib/observability";
import { fullName, uploadUrl } from "@/lib/storage";
import { getVibe } from "@/lib/vibes";

export const metadata: Metadata = { title: "Generation request · Control Center" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RequestRow = {
  id: string;
  source: string;
  chain_name: string | null;
  vibe: string | null;
  image_path: string | null;
  context: string | null;
  status: string;
  error: string | null;
  generation_id: string | null;
  created_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
  generations: { image_path: string } | null;
};

// READ one generation request and every LLM response it produced, in order.
export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const { supabase } = await requireSuperadmin();
  const { id } = await params;
  if (!UUID.test(id)) {
    notFound();
  }

  const [{ data: request }, { data: responses }] = await Promise.all([
    supabase
      .from("generation_requests")
      .select(
        "id, source, chain_name, vibe, image_path, context, status, error, generation_id, created_at, finished_at, duration_ms, profiles(first_name, last_name), generations(image_path)",
      )
      .eq("id", id)
      .maybeSingle<RequestRow>(),
    supabase
      .from("llm_responses")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: true })
      .returns<LlmResponse[]>(),
  ]);

  if (!request) {
    notFound();
  }

  // Failed requests' photos are deleted, so only show a photo that still has a generation.
  const imagePath = request.generations?.image_path ?? null;
  const details = [
    ["Status", <StatusBadge key="s" status={request.status} />],
    ["Requested by", `${request.profiles ? fullName(request.profiles) : "—"}${request.source === "admin" ? " (admin area)" : ""}`],
    ["Started", formatDateTime(request.created_at)],
    ["Total time", formatDuration(request.duration_ms)],
    ["Prompt chain", request.chain_name ?? "—"],
    ["Vibe", request.vibe ? `${getVibe(request.vibe).emoji} ${getVibe(request.vibe).label}` : "—"],
    ["Context note", request.context ?? "—"],
  ] as const;

  return (
    <div className="space-y-6">
      <Link href="/requests" className="text-sm font-bold text-ink-2 hover:text-white">
        ← All requests
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Generation request</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section className={`${panelClass} p-5`}>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
            {details.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-ink-3">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {request.error && (
            <p className="mt-4 rounded-md border border-mta-red p-3 font-mono text-xs break-words text-red-300">{request.error}</p>
          )}
          {request.generation_id && (
            <Link href={`/media/${request.generation_id}`} className="mt-4 inline-block text-sm font-bold text-ink-2 hover:text-white">
              Open the generated media →
            </Link>
          )}
        </section>

        {imagePath && (
          <div className={`${panelClass} relative aspect-[4/3] overflow-hidden bg-black`}>
            <Image src={uploadUrl(imagePath)} alt="Photo for this request" fill unoptimized className="object-contain" />
          </div>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">LLM responses ({responses?.length ?? 0})</h2>
        <p className="text-sm text-ink-3">Every call the pipeline made, including models that failed before a fallback succeeded.</p>
        {(responses ?? []).map((response) => (
          <LlmResponseCard key={response.id} response={response} />
        ))}
        {(responses ?? []).length === 0 && <p className="text-sm text-ink-3">No LLM calls were logged for this request.</p>}
      </section>
    </div>
  );
}
