"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ScoringWeights } from "@/lib/mixbrain/transition-score";

const DEFAULT_WEIGHTS: ScoringWeights = {
  bpm: 7,
  energy: 13,
  moment: 22,
  harmony: 16,
  texture: 9,
  diversity: 5,
  narrative: 28,
};

function parseWeights(input: Partial<ScoringWeights>): ScoringWeights {
  const keys = Object.keys(DEFAULT_WEIGHTS) as (keyof ScoringWeights)[];
  const weights = Object.fromEntries(keys.map((key) => {
    const value = Number(input[key] ?? DEFAULT_WEIGHTS[key]);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Peso inválido para ${key}.`);
    return [key, value];
  })) as ScoringWeights;
  if (Object.values(weights).every((value) => value === 0)) throw new Error("Pelo menos um peso deve ser maior que zero.");
  return weights;
}

export async function updateScoringWeights(projectId: string, weights: Partial<ScoringWeights>) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) throw new Error("Não autenticado.");
  if (!projectId) throw new Error("Projeto inválido.");
  const parsed = parseWeights(weights);
  const { error } = await supabase.from("set_projects").update({ scoring_weights: parsed }).eq("id", projectId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/projetos/${projectId}`);
  return parsed;
}
