import type { Metadata } from "next";
import Link from "next/link";
import { panelClass, secondaryButtonClass } from "@/components/ui";
import { requireSuperadmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { getReaction, isReactionId, REACTIONS, type ReactionId } from "@/lib/reactions";
import { fullName } from "@/lib/storage";

export const metadata: Metadata = { title: "Ratings · Control Center" };

const PAGE_SIZE = 50;

type VoteRow = {
  user_id: string;
  caption_id: string;
  reaction: ReactionId;
  created_at: string;
  updated_at: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
  captions: { text: string; generation_id: string } | null;
};

function ratingsHref(reaction: ReactionId | undefined, page: number) {
  const params = new URLSearchParams();
  if (reaction) params.set("reaction", reaction);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/ratings?${query}` : "/ratings";
}

// Read-only log of every reaction (admins can read all votes through an RLS policy).
export default async function RatingsPage({ searchParams }: PageProps<"/ratings">) {
  const { supabase } = await requireSuperadmin();
  const { reaction: reactionParam, page: pageParam } = await searchParams;
  const reaction = isReactionId(reactionParam) ? reactionParam : undefined;
  const page = Math.max(1, Number(pageParam) || 1);

  let query = supabase
    .from("caption_votes")
    .select(
      "user_id, caption_id, reaction, created_at, updated_at, profiles(first_name, last_name), captions(text, generation_id)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (reaction) {
    query = query.eq("reaction", reaction);
  }

  const [{ data, count, error }, ...reactionCounts] = await Promise.all([
    query.returns<VoteRow[]>(),
    ...REACTIONS.map((r) =>
      supabase.from("caption_votes").select("caption_id", { count: "exact", head: true }).eq("reaction", r.id),
    ),
  ]);
  const votes = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ratings</h1>
        <p className="mt-1 text-ink-3">Every reaction on every caption, newest first · read-only</p>
      </div>

      <nav aria-label="Filter by reaction" className="flex flex-wrap gap-2">
        <Link
          href={ratingsHref(undefined, 1)}
          aria-current={!reaction ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-bold ${!reaction ? "bg-white text-black" : "border border-edge text-ink-2 hover:text-white"}`}
        >
          All
        </Link>
        {REACTIONS.map((r, i) => (
          <Link
            key={r.id}
            href={ratingsHref(r.id, 1)}
            aria-current={reaction === r.id ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ${
              reaction === r.id ? "bg-white text-black" : "border border-edge text-ink-2 hover:text-white"
            }`}
          >
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: r.chartColor }} />
            {r.emoji} {r.label}
            <span className="tabular-nums opacity-70">{reactionCounts[i].count ?? 0}</span>
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="rounded-md border border-mta-red p-4 text-red-300">Could not load ratings: {error.message}</p>
      ) : (
        <div className={`${panelClass} overflow-x-auto`}>
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-panel-2 text-ink-2">
              <tr className="[&_th]:px-4 [&_th]:py-2.5">
                <th>Reaction</th>
                <th>Caption</th>
                <th>By</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {votes.map((v) => {
                const r = getReaction(v.reaction);
                return (
                  <tr key={`${v.user_id}-${v.caption_id}`} className="border-t border-edge [&_td]:px-4 [&_td]:py-3">
                    <td className="whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: r.chartColor }} />
                        {r.emoji} {r.label}
                      </span>
                    </td>
                    <td>
                      {v.captions ? (
                        <Link href={`/media/${v.captions.generation_id}`} className="hover:underline">
                          {v.captions.text}
                        </Link>
                      ) : (
                        <span className="text-ink-3">Deleted caption</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-ink-2">{v.profiles ? fullName(v.profiles) : "—"}</td>
                    <td className="whitespace-nowrap text-ink-2">
                      {formatDateTime(v.updated_at)}
                      {v.updated_at !== v.created_at && <span className="ml-1 text-xs text-ink-3">(changed)</span>}
                    </td>
                  </tr>
                );
              })}
              {votes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-ink-3">
                    No reactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={ratingsHref(reaction, page - 1)} className={secondaryButtonClass}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-3">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={ratingsHref(reaction, page + 1)} className={secondaryButtonClass}>
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
