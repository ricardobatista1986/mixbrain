"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createSetProject(formData: FormData) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

  const rawName = formData.get("name");
  const rawDescription = formData.get("description");
  const rawTargetDuration = formData.get("targetDurationMinutes");

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const description =
    typeof rawDescription === "string" ? rawDescription.trim() : "";
  const targetDurationMinutes =
    typeof rawTargetDuration === "string" && rawTargetDuration.trim() !== ""
      ? Number(rawTargetDuration)
      : null;

  if (!name) {
    throw new Error("O nome do projeto é obrigatório.");
  }

  if (
    targetDurationMinutes !== null &&
    (!Number.isFinite(targetDurationMinutes) || targetDurationMinutes <= 0)
  ) {
    throw new Error("A duração alvo deve ser um número positivo.");
  }

  const { error } = await supabase.from("set_projects").insert({
    user_id: claims.sub,
    name,
    description: description || null,
    target_duration_minutes: targetDurationMinutes,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
}

export async function deleteSetProject(projectId: string) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

  if (!projectId) {
    throw new Error("Projeto inválido.");
  }

  // Todas as tabelas filhas (candidatas, tracklist, blocos, versões,
  // transições aprovadas, eventos de curadoria) têm ON DELETE CASCADE
  // para set_projects, então este delete limpa tudo relacionado ao
  // projeto de uma vez, sem deixar registros órfãos.
  const { error, count } = await supabase
    .from("set_projects")
    .delete({ count: "exact" })
    .eq("id", projectId)
    .eq("user_id", claims.sub);

  if (error) {
    throw new Error(error.message);
  }

  if (!count) {
    throw new Error("Projeto não encontrado ou sem permissão para excluir.");
  }

  revalidatePath("/app");
}

export async function archiveSetProject(projectId: string) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

  if (!projectId) {
    throw new Error("Projeto inválido.");
  }

  const { error } = await supabase
    .from("set_projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", claims.sub);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
}

export async function unarchiveSetProject(projectId: string) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

  if (!projectId) {
    throw new Error("Projeto inválido.");
  }

  const { error } = await supabase
    .from("set_projects")
    .update({ archived_at: null })
    .eq("id", projectId)
    .eq("user_id", claims.sub);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
}

/**
 * Duplica um projeto inteiro: dados do projeto, blocos congelados,
 * candidatas e tracklist (com a ordem e os momentos curatoriais). As
 * tracks em si não são duplicadas — o clone referencia as mesmas tracks da
 * biblioteca, só a estrutura do projeto é copiada. Útil para testar uma
 * variação do set sem arriscar o original.
 */
export async function duplicateSetProject(projectId: string) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

  if (!projectId) {
    throw new Error("Projeto inválido.");
  }

  const userId = claims.sub;

  const { data: original, error: originalError } = await supabase
    .from("set_projects")
    .select(
      "name, description, target_duration_minutes, bpm_min, bpm_max, narrative_brief, scoring_weights"
    )
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (originalError || !original) {
    throw new Error("Projeto não encontrado ou sem permissão.");
  }

  const { data: newProject, error: newProjectError } = await supabase
    .from("set_projects")
    .insert({
      user_id: userId,
      name: `${original.name} (cópia)`,
      description: original.description,
      target_duration_minutes: original.target_duration_minutes,
      bpm_min: original.bpm_min,
      bpm_max: original.bpm_max,
      narrative_brief: original.narrative_brief,
      scoring_weights: original.scoring_weights,
    })
    .select("id")
    .single();

  if (newProjectError || !newProject) {
    throw new Error(newProjectError?.message || "Erro ao duplicar o projeto.");
  }

  const newProjectId = newProject.id as string;

  // Blocos congelados primeiro, para poder mapear block_id antigo -> novo.
  const { data: originalBlocks, error: blocksError } = await supabase
    .from("set_blocks")
    .select("id, name")
    .eq("project_id", projectId);

  if (blocksError) {
    throw new Error(blocksError.message);
  }

  const blockIdMap = new Map<string, string>();

  for (const block of originalBlocks ?? []) {
    const { data: newBlock, error: newBlockError } = await supabase
      .from("set_blocks")
      .insert({ project_id: newProjectId, name: block.name })
      .select("id")
      .single();

    if (newBlockError || !newBlock) {
      throw new Error(newBlockError?.message || "Erro ao duplicar bloco.");
    }

    blockIdMap.set(block.id, newBlock.id);
  }

  const { data: originalCandidates, error: candidatesError } = await supabase
    .from("set_candidates")
    .select("track_id, status, notes, sort_order")
    .eq("project_id", projectId);

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  if (originalCandidates && originalCandidates.length > 0) {
    const { error: insertCandidatesError } = await supabase
      .from("set_candidates")
      .insert(
        originalCandidates.map((candidate) => ({
          project_id: newProjectId,
          track_id: candidate.track_id,
          user_id: userId,
          status: candidate.status,
          notes: candidate.notes,
          sort_order: candidate.sort_order,
        }))
      );

    if (insertCandidatesError) {
      throw new Error(insertCandidatesError.message);
    }
  }

  const { data: originalItems, error: itemsError } = await supabase
    .from("set_tracklist_items")
    .select("track_id, position, block_id, curatorial_moment, curatorial_intent")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  if (originalItems && originalItems.length > 0) {
    const { error: insertItemsError } = await supabase
      .from("set_tracklist_items")
      .insert(
        originalItems.map((item) => ({
          project_id: newProjectId,
          track_id: item.track_id,
          position: item.position,
          block_id: item.block_id ? blockIdMap.get(item.block_id) ?? null : null,
          curatorial_moment: item.curatorial_moment,
          curatorial_intent: item.curatorial_intent,
        }))
      );

    if (insertItemsError) {
      throw new Error(insertItemsError.message);
    }
  }

  revalidatePath("/app");

  return { newProjectId };
}
