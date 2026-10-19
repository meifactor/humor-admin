import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { panelClass, primaryButtonClass } from "@/components/ui";
import { requireSuperadmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { fullName, uploadUrl } from "@/lib/storage";
import { getVibe, isVibeId, VIBES } from "@/lib/vibes";

export const metadata: Metadata = { title: "Media · Control Center" };

type GenerationRow = {
  id: string;
  image_path: string;
  context: string | null;
  vibe: string;
  model: string;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
  captions: { id: string; text: string; score: number }[];
};

export default async function MediaPage({ searchParams }: PageProps<"/media">) {
  const { supabase } = await requireSuperadmin();
  const { vibe: vibeParam } = await searchParams;
  const vibe = isVibeId(vibeParam) ? vibeParam : undefined;

  let query = supabase
    .from("generations")
    .select("id, image_path, context, vibe, model, created_at, profiles(first_name, last_name), captions(id, text, score)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (vibe) {
    query = query.eq("vibe", vibe);
  }
  const { data, error } = await query.returns<GenerationRow[]>();
  const generations = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI-generated media</h1>
          <p className="mt-1 text-ink-3">
            {generations.length} {generations.length === 1 ? "photo" : "photos"} with AI captions
          </p>
        </div>
        <Link href="/media/new" className={primaryButtonClass}>
          + New generation
        </Link>
      </div>

      <nav aria-label="Filter by vibe" className="flex flex-wrap gap-2">
        <Link
          href="/media"
          aria-current={!vibe ? "page" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-bold ${!vibe ? "bg-white text-black" : "border border-edge text-ink-2 hover:text-white"}`}
        >
          All vibes
        </Link>
        {VIBES.map((v) => (
          <Link
            key={v.id}
            href={`/media?vibe=${v.id}`}
            aria-current={vibe === v.id ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-bold ${
              vibe === v.id ? "bg-white text-black" : "border border-edge text-ink-2 hover:text-white"
            }`}
          >
            {v.emoji} {v.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="rounded-md border border-mta-red p-4 text-red-300">Could not load media: {error.message}</p>
      ) : generations.length === 0 ? (
        <p className={`${panelClass} p-6 text-ink-3`}>No generations{vibe ? " with this vibe" : ""} yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {generations.map((g) => {
            const best = [...g.captions].sort((a, b) => b.score - a.score)[0];
            const vibeInfo = getVibe(g.vibe);
            return (
              <li key={g.id}>
                <Link href={`/media/${g.id}`} className={`${panelClass} group block overflow-hidden hover:border-white`}>
                  <div className="relative aspect-[4/3] bg-black">
                    <Image src={uploadUrl(g.image_path)} alt={g.context ?? "Uploaded photo"} fill unoptimized className="object-cover" />
                    <span className="absolute top-2 left-2 rounded-full bg-black/80 px-2 py-0.5 text-xs font-bold">
                      {vibeInfo.emoji} {vibeInfo.label}
                    </span>
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="line-clamp-2 font-bold group-hover:underline">{best?.text ?? "No captions"}</p>
                    <p className="text-xs text-ink-3">
                      {g.captions.length} captions · best score {best?.score ?? 0}
                    </p>
                    <p className="text-xs text-ink-3">
                      {g.profiles ? fullName(g.profiles) : "Unknown"} · {formatDateTime(g.created_at)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
