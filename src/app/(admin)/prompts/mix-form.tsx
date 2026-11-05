"use client";

import { useActionState, useState } from "react";
import { primaryButtonClass } from "@/components/ui";
import { updateMix, type MixState } from "./actions";

const BAR_COLORS = ["#e66767", "#3987e5", "#c98500", "#199e70"];

export function MixForm({ chains }: { chains: { id: string; name: string; weight: number }[] }) {
  const [state, formAction, pending] = useActionState<MixState, FormData>(updateMix, { status: "idle" });
  const [weights, setWeights] = useState(() => Object.fromEntries(chains.map((c) => [c.id, c.weight])));
  const total = Object.values(weights).reduce((sum, w) => sum + (Number(w) || 0), 0);

  return (
    <form action={formAction} className="space-y-4">
      {/* Live preview: each chain's share of new generations. */}
      <div className="flex h-5 gap-[2px] overflow-hidden rounded" aria-hidden>
        {chains.map((chain, i) =>
          weights[chain.id] > 0 ? (
            <div key={chain.id} style={{ flexGrow: weights[chain.id], backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
          ) : null,
        )}
        {total === 0 && <div className="flex-1 bg-panel-2" />}
      </div>

      <ul className="space-y-3">
        {chains.map((chain, i) => (
          <li key={chain.id} className="grid items-center gap-3 sm:grid-cols-[1fr_8rem_4rem]">
            <span className="flex items-center gap-2 font-bold">
              <span aria-hidden className="h-3 w-3 rounded-sm" style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
              {chain.name}
            </span>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              Weight
              <input
                type="number"
                name={`weight:${chain.id}`}
                min={0}
                max={100}
                required
                value={weights[chain.id]}
                onChange={(event) => setWeights((w) => ({ ...w, [chain.id]: Number(event.target.value) }))}
                className="w-20 rounded-md border border-edge bg-background px-2 py-1 text-white"
              />
            </label>
            <span className="text-right font-bold tabular-nums">
              {total ? Math.round(((weights[chain.id] || 0) / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : "Save mix"}
        </button>
        {state.message && (
          <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-red-300" : "text-sm text-green-400"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
