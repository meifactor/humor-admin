import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { panelClass } from "@/components/ui";
import { requireSuperadmin } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { REACTIONS } from "@/lib/reactions";
import { fullName, uploadUrl } from "@/lib/storage";
import { deleteCaption, deleteGeneration } from "../actions";
import { CaptionEditor, ConfirmButton, GenerationForm } from "./editors";

export const metadata: Metadata = { title: "Edit media · Control Center" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CaptionRow = {
  id: string;
  text: string;
  position: number;
  dead_count: number;
  huh_count: number;
  funny_count: number;
  cringe_count: number;
  score: number;
};

type GenerationRow = {
  id: string;
  image_path: string;
  context: string | null;
  vibe: string;
  prompt: string;
  model: string;
  created_at: string;
  profiles: { first_name: string | null; last_name: string | null } | null;
  captions: CaptionRow[];
};

export default async function MediaDetailPage({ params }: PageProps<"/media/[id]">) {
  const { supabase } = await requireSuperadmin();
  const { id } = await params;
  if (!UUID.test(id)) {
    notFound();
  }

  const { data: generation } = await supabase
    .from("generations")
    .select(
      "id, image_path, context, vibe, prompt, model, created_at, profiles(first_name, last_name), captions(id, text, position, dead_count, huh_count, funny_count, cringe_count, score)",
    )
    .eq("id", id)
    .maybeSingle<GenerationRow>();

  if (!generation) {
    notFound();
  }
  const captions = [...generation.captions].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6">
      <Link href="/media" className="text-sm font-bold text-ink-2 hover:text-white">
        ← All media
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className={`${panelClass} relative aspect-[4/3] overflow-hidden bg-black`}>
          <Image src={uploadUrl(generation.image_path)} alt={generation.context ?? "Uploaded photo"} fill unoptimized className="object-contain" />
        </div>

        <div className="space-y-4">
          <section className={`${panelClass} space-y-1 p-5 text-sm`}>
            <p>
              <span className="text-ink-3">Posted by </span>
              <strong>{generation.profiles ? fullName(generation.profiles) : "Unknown"}</strong>
            </p>
            <p className="text-ink-3">{formatDateTime(generation.created_at)}</p>
            <p className="text-ink-3">
              Model <code className="text-ink-2">{generation.model}</code>
            </p>
          </section>

          <section className={`${panelClass} p-5`}>
            <h2 className="mb-3 font-bold">Details</h2>
            <GenerationForm id={generation.id} context={generation.context} vibe={generation.vibe} />
          </section>

          <details className={`${panelClass} p-5 text-sm`}>
            <summary className="cursor-pointer font-bold">Prompt sent to Gemini</summary>
            <pre className="mt-3 overflow-x-auto font-mono text-xs whitespace-pre-wrap text-ink-2">{generation.prompt}</pre>
          </details>

          <form action={deleteGeneration} className={`${panelClass} p-5`}>
            <input type="hidden" name="id" value={generation.id} />
            <p className="mb-3 text-sm text-ink-3">Deletes the photo, all its captions and every reaction to them.</p>
            <ConfirmButton
              label="Delete generation"
              confirmText="Delete this photo, its captions and all their reactions? This can't be undone."
            />
          </form>
        </div>
      </div>

      <section className={`${panelClass} p-5`}>
        <h2 className="text-lg font-bold">Captions</h2>
        <p className="mb-4 text-sm text-ink-3">Edit the text or delete a caption. Reactions stay with the caption when you edit it.</p>
        {captions.length === 0 ? (
          <p className="text-ink-3">No captions left.</p>
        ) : (
          <ol className="divide-y divide-edge">
            {captions.map((caption) => (
              <li key={caption.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-start">
                <CaptionEditor id={caption.id} text={caption.text} />
                <div className="flex shrink-0 flex-col items-start gap-3 md:w-56 md:items-end">
                  <p className="flex flex-wrap gap-2 text-sm">
                    {REACTIONS.map((r) => (
                      <span key={r.id} className="flex items-center gap-1 tabular-nums" title={r.label}>
                        <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: r.chartColor }} />
                        {r.emoji} {caption[`${r.id}_count`]}
                      </span>
                    ))}
                  </p>
                  <p className="text-sm font-bold">Score {caption.score}</p>
                  <form action={deleteCaption}>
                    <input type="hidden" name="id" value={caption.id} />
                    <ConfirmButton label="Delete" confirmText="Delete this caption and its reactions?" compact />
                  </form>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
