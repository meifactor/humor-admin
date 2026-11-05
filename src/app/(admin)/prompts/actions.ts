"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/admin";

export type MixState = { status: "idle" | "success" | "error"; message?: string };

// UPDATE: the prompt chain mix (each chain's relative weight, 0–100).
export async function updateMix(_prev: MixState, formData: FormData): Promise<MixState> {
  const { supabase } = await requireSuperadmin();

  const weights: { chain_id: string; weight: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("weight:")) continue;
    const weight = Number(value);
    if (!Number.isInteger(weight) || weight < 0 || weight > 100) {
      return { status: "error", message: "Weights must be whole numbers from 0 to 100." };
    }
    weights.push({ chain_id: key.slice("weight:".length), weight });
  }

  if (!weights.some((w) => w.weight > 0)) {
    return { status: "error", message: "At least one chain needs a weight above 0." };
  }

  for (const { chain_id, weight } of weights) {
    const { error } = await supabase
      .from("prompt_chain_mix")
      .update({ weight, updated_at: new Date().toISOString() })
      .eq("chain_id", chain_id);
    if (error) return { status: "error", message: `Couldn't save: ${error.message}` };
  }

  revalidatePath("/prompts");
  return { status: "success", message: "Mix saved. New generations use it right away." };
}
