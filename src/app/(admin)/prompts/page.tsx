import type { Metadata } from "next";
import { Panel } from "@/components/panel";
import { panelClass } from "@/components/ui";
import { requireSuperadmin } from "@/lib/admin";
import { MixForm } from "./mix-form";

export const metadata: Metadata = { title: "Prompt chains · Control Center" };

type ChainRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  prompt_chain_mix: { weight: number; updated_at: string } | null;
  prompt_chain_steps: {
    id: string;
    position: number;
    name: string;
    template: string;
    output_format: string;
    uses_image: boolean;
  }[];
};

// READ prompt chains and their steps; READ/UPDATE the chain mix.
export default async function PromptsPage() {
  const { supabase } = await requireSuperadmin();
  const { data, error } = await supabase
    .from("prompt_chains")
    .select(
      "id, slug, name, description, is_active, prompt_chain_mix(weight, updated_at), prompt_chain_steps(id, position, name, template, output_format, uses_image)",
    )
    .order("created_at")
    .returns<ChainRow[]>();
  const chains = data ?? [];

  // How often each chain was actually used, from the request log.
  const usage = await Promise.all(
    chains.map((chain) =>
      supabase.from("generation_requests").select("id", { count: "exact", head: true }).eq("chain_id", chain.id),
    ),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prompt chains</h1>
        <p className="mt-1 max-w-3xl text-ink-3">
          Captions are written by a prompt chain: each step&apos;s output feeds the next. For every
          new photo the app picks one chain at random, weighted by the mix below.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-mta-red p-4 text-red-300">
          Could not load prompt chains: {error.message}. Has <code>supabase/observability.sql</code> been run?
        </p>
      ) : (
        <>
          <Panel title="Prompt chain mix" subtitle="Relative weights: a chain with weight 0 is never picked.">
            <MixForm chains={chains.map((c) => ({ id: c.id, name: c.name, weight: c.prompt_chain_mix?.weight ?? 0 }))} />
          </Panel>

          {chains.map((chain, index) => (
            <Panel
              key={chain.id}
              title={chain.name}
              subtitle={`${chain.slug} · ${chain.is_active ? "active" : "inactive"} · used for ${usage[index].count ?? 0} requests`}
            >
              {chain.description && <p className="mb-4 text-sm text-ink-2">{chain.description}</p>}
              <ol className="space-y-3">
                {[...chain.prompt_chain_steps]
                  .sort((a, b) => a.position - b.position)
                  .map((step) => (
                    <li key={step.id} className={`${panelClass} bg-background p-4`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-black">
                          {step.position}
                        </span>
                        <span className="font-bold">{step.name}</span>
                        <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-2">
                          outputs {step.output_format === "captions" ? "captions (JSON)" : "text"}
                        </span>
                        {step.uses_image && (
                          <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-2">sees the photo</span>
                        )}
                      </div>
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer font-bold text-ink-2 hover:text-white">Prompt template</summary>
                        <pre className="mt-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap text-ink-2">{step.template}</pre>
                      </details>
                    </li>
                  ))}
              </ol>
            </Panel>
          ))}
        </>
      )}
    </div>
  );
}
