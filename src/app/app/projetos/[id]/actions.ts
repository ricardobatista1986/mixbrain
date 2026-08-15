"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  buildAutoSequence,
  type SequenceUnit,
} from "@/lib/mixbrain/auto-sequence";
import type {
  CuratorialMoment,
  ScoreTrack,
  ScoreTracklistItemContext,
} from "@/lib/mixbrain/transition-score";
import { normalizeScoringWeights } from "@/lib/mixbrain/transition-score";

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

type OrderUpdateItem = {
  id: string;
  newPosition: number;
};

async function requireAuth() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();

  if (!authData?.claims?.sub) {
    throw new Error("Não autenticado.");
  }

  return {
    supabase,
    userId: authData.claims.sub,
  };
}

async function ensureProjectOwnership(
  supabase: SupabaseLike,
  projectId: string,
  userId: string
) {
  const { data: project, error } = await supabase
    .from("set_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error || !project) {
    throw new Error("Projeto não encontrado.");
  }
}

async function applyNewOrder(
  supabase: SupabaseLike,
  projectId: string,
  newOrderArray: OrderUpdateItem[]
) {
  for (const item of newOrderArray) {
    const { error } = await supabase
      .from("set_tracklist_items")
      .update({ position: -item.newPosition })
      .eq("id", item.id)
      .eq("project_id", projectId);

    if (error) {
      throw new Error(error.message);
    }
  }

  for (const item of newOrderArray) {
    const { error } = await supabase
      .from("set_tracklist_items")
      .update({ position: item.newPosition })
      .eq("id", item.id)
      .eq("project_id", projectId);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function addCandidate(projectId: string, formData: FormData) {
  const { supabase, userId } = await requireAuth();

  await ensureProjectOwnership(supabase, projectId, userId);

  const trackId = String(formData.get("trackId") || "");
  const notes = String(formData.get("notes") || "").trim();

  if (!trackId) {
    throw new Error("Selecione uma track.");
  }

  const { data: lastCandidate, error: lastCandidateError } = await supabase
    .from("set_candidates")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);

  if (lastCandidateError) {
    throw new Error(lastCandidateError.message);
  }

  const nextSortOrder = (lastCandidate?.[0]?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("set_candidates").insert({
    project_id: projectId,
    track_id: trackId,
    user_id: userId,
    notes: notes || null,
    sort_order: nextSortOrder,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/app/projetos/${projectId}`);
}

/**
 * Adiciona várias tracks da biblioteca como candidatas de uma vez — usado
 * pelo painel de sugestões inteligentes (seleção múltipla). Tracks que já
 * são candidatas do projeto são ignoradas silenciosamente (idempotente).
 */
export async function addCandidatesBulk(projectId: string, trackIds: string[]) {
  const { supabase, userId } = await requireAuth();

  await ensureProjectOwnership(supabase, projectId, userId);

  const uniqueTrackIds = [...new Set(trackIds.filter(Boolean))];

  if (uniqueTrackIds.length === 0) {
    return { added: 0 };
  }

  const { data: existing, error: existingError } = await supabase
    .from("set_candidates")
    .select("track_id, sort_order")
    .eq("project_id", projectId);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingTrackIds = new Set((existing ?? []).map((row) => row.track_id));

  let nextSortOrder =
    Math.max(0, ...(existing ?? []).map((row) => row.sort_order ?? 0)) + 1;

  const rows = uniqueTrackIds
    .filter((trackId) => !existingTrackIds.has(trackId))
    .map((trackId) => ({
      project_id: projectId,
      track_id: trackId,
      user_id: userId,
      status: "candidate",
      sort_order: nextSortOrder++,
      notes: null,
    }));

  if (rows.length > 0) {
    const { error } = await supabase.from("set_candidates").insert(rows);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath(`/app/projetos/${projectId}`);

  return { added: rows.length };
}

/**
 * Remove uma candidata do projeto (sem tocar na track da biblioteca). Usado
 * pela caixa de "fora do padrão do set" — o usuário decide, track por
 * track, se remove ou mantém mesmo assim.
 */
export async function removeCandidate(projectId: string, candidateId: string) {
  const { supabase, userId } = await requireAuth();

  await ensureProjectOwnership(supabase, projectId, userId);

  if (!candidateId) {
    throw new Error("Candidata inválida.");
  }

  const { error } = await supabase
    .from("set_candidates")
    .delete()
    .eq("id", candidateId)
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/app/projetos/${projectId}`);
}

/**
 * Remove várias candidatas de uma vez — usado pelo botão "Remover todas as
 * destacadas" da caixa de fora do padrão.
 */
export async function removeCandidatesBulk(
  projectId: string,
  candidateIds: string[]
) {
  const { supabase, userId } = await requireAuth();

  await ensureProjectOwnership(supabase, projectId, userId);

  const uniqueIds = [...new Set(candidateIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return { removed: 0 };
  }

  const { error, count } = await supabase
    .from("set_candidates")
    .delete({ count: "exact" })
    .in("id", uniqueIds)
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/app/projetos/${projectId}`);

  return { removed: count ?? 0 };
}

export async function approveCandidateToTracklist(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const trackId = String(formData.get("track_id") || "");

  if (!projectId || !trackId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { data: existingItems, error: existingError } = await supabase
    .from("set_tracklist_items")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const nextPosition = (existingItems?.[0]?.position ?? 0) + 1;

  const { error } = await supabase.from("set_tracklist_items").insert({
    project_id: projectId,
    track_id: trackId,
    position: nextPosition,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logCurationEvent(supabase, userId, projectId, "track_included", { track_id: trackId });

  revalidatePath(`/app/projetos/${projectId}`);
}

export async function removeFromTracklist(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const tracklistItemId = String(formData.get("tracklist_item_id") || "");

  if (!projectId || !tracklistItemId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { error } = await supabase
    .from("set_tracklist_items")
    .delete()
    .eq("id", tracklistItemId)
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  const { data: remainingItems, error: remainingError } = await supabase
    .from("set_tracklist_items")
    .select("id")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (remainingError) {
    throw new Error(remainingError.message);
  }

  const reordered = (remainingItems ?? []).map((item, index) => ({
    id: item.id,
    newPosition: index + 1,
  }));

  await applyNewOrder(supabase, projectId, reordered);

  await logCurationEvent(supabase, userId, projectId, "track_removed", {
    tracklist_item_id: tracklistItemId,
  });

  revalidatePath(`/app/projetos/${projectId}`);
}

export async function createFrozenBlock(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const blockName = String(formData.get("block_name") || "").trim();
  const selectedItems = formData
    .getAll("selected_items")
    .map((value) => String(value))
    .filter(Boolean);

  if (!projectId || !blockName || selectedItems.length < 2) {
    throw new Error("Selecione pelo menos duas tracks e dê um nome ao bloco.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { data: block, error: blockError } = await supabase
    .from("set_blocks")
    .insert({
      project_id: projectId,
      name: blockName,
    })
    .select("id")
    .single();

  if (blockError || !block) {
    throw new Error(blockError?.message || "Erro ao criar bloco.");
  }

  const { error: updateError } = await supabase
    .from("set_tracklist_items")
    .update({ block_id: block.id })
    .in("id", selectedItems)
    .eq("project_id", projectId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await logCurationEvent(supabase, userId, projectId, "block_frozen", {
    block_name: blockName,
    item_count: selectedItems.length,
  });

  revalidatePath(`/app/projetos/${projectId}`);
}

export async function dissolveFrozenBlock(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const blockId = String(formData.get("block_id") || "");

  if (!projectId || !blockId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { error: itemsError } = await supabase
    .from("set_tracklist_items")
    .update({ block_id: null })
    .eq("project_id", projectId)
    .eq("block_id", blockId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const { error: blockError } = await supabase
    .from("set_blocks")
    .delete()
    .eq("id", blockId)
    .eq("project_id", projectId);

  if (blockError) {
    throw new Error(blockError.message);
  }

  await logCurationEvent(supabase, userId, projectId, "block_unfrozen", { block_id: blockId });

  revalidatePath(`/app/projetos/${projectId}`);
}

export async function moveEntityUp(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const entityId = String(formData.get("entity_id") || "");
  const isBlock = String(formData.get("is_block") || "") === "true";

  if (!projectId || !entityId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { data: items, error } = await supabase
    .from("set_tracklist_items")
    .select("id, position, block_id")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = items ?? [];
  const groups: { key: string; itemIds: string[] }[] = [];
  let currentBlockId: string | null = null;

  for (const row of rows) {
    if (row.block_id) {
      if (row.block_id !== currentBlockId) {
        currentBlockId = row.block_id;
        groups.push({
          key: `block:${row.block_id}`,
          itemIds: [row.id],
        });
      } else {
        groups[groups.length - 1].itemIds.push(row.id);
      }
    } else {
      currentBlockId = null;
      groups.push({
        key: `item:${row.id}`,
        itemIds: [row.id],
      });
    }
  }

  const targetKey = isBlock ? `block:${entityId}` : `item:${entityId}`;
  const currentIndex = groups.findIndex((group) => group.key === targetKey);

  if (currentIndex <= 0) {
    revalidatePath(`/app/projetos/${projectId}`);
    return;
  }

  const reorderedGroups = [...groups];
  [reorderedGroups[currentIndex - 1], reorderedGroups[currentIndex]] = [
    reorderedGroups[currentIndex],
    reorderedGroups[currentIndex - 1],
  ];

  const flattenedIds = reorderedGroups.flatMap((group) => group.itemIds);
  const newOrderArray = flattenedIds.map((id, index) => ({
    id,
    newPosition: index + 1,
  }));

  await applyNewOrder(supabase, projectId, newOrderArray);

  revalidatePath(`/app/projetos/${projectId}`);
}

export async function moveEntityDown(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const entityId = String(formData.get("entity_id") || "");
  const isBlock = String(formData.get("is_block") || "") === "true";

  if (!projectId || !entityId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { data: items, error } = await supabase
    .from("set_tracklist_items")
    .select("id, position, block_id")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = items ?? [];
  const groups: { key: string; itemIds: string[] }[] = [];
  let currentBlockId: string | null = null;

  for (const row of rows) {
    if (row.block_id) {
      if (row.block_id !== currentBlockId) {
        currentBlockId = row.block_id;
        groups.push({
          key: `block:${row.block_id}`,
          itemIds: [row.id],
        });
      } else {
        groups[groups.length - 1].itemIds.push(row.id);
      }
    } else {
      currentBlockId = null;
      groups.push({
        key: `item:${row.id}`,
        itemIds: [row.id],
      });
    }
  }

  const targetKey = isBlock ? `block:${entityId}` : `item:${entityId}`;
  const currentIndex = groups.findIndex((group) => group.key === targetKey);

  if (currentIndex === -1 || currentIndex >= groups.length - 1) {
    revalidatePath(`/app/projetos/${projectId}`);
    return;
  }

  const reorderedGroups = [...groups];
  [reorderedGroups[currentIndex], reorderedGroups[currentIndex + 1]] = [
    reorderedGroups[currentIndex + 1],
    reorderedGroups[currentIndex],
  ];

  const flattenedIds = reorderedGroups.flatMap((group) => group.itemIds);
  const newOrderArray = flattenedIds.map((id, index) => ({
    id,
    newPosition: index + 1,
  }));

  await applyNewOrder(supabase, projectId, newOrderArray);

  revalidatePath(`/app/projetos/${projectId}`);
}

export async function updateCuratorialFields(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const tracklistItemId = String(formData.get("tracklist_item_id") || "");
  const curatorialMomentRaw = String(
    formData.get("curatorial_moment") || ""
  ).trim();

  if (!projectId || !tracklistItemId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const curatorialMoment = curatorialMomentRaw || null;

  const allowedMoments = new Set([
    "opening",
    "build",
    "valley",
    "peak",
    "contemplation",
    "closing",
  ]);

  if (curatorialMoment && !allowedMoments.has(curatorialMoment)) {
    throw new Error("Momento curatorial inválido.");
  }

  const { error } = await supabase
    .from("set_tracklist_items")
    .update({
      curatorial_moment: curatorialMoment,
    })
    .eq("id", tracklistItemId)
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/app/projetos/${projectId}`);
}

export async function updateSetProject(
  projectId: string,
  formData: FormData
) {
  const { supabase, userId } = await requireAuth();

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();

  const targetDurationRaw = String(
    formData.get("target_duration_minutes") || ""
  ).trim();

  const bpmMinRaw = String(formData.get("bpm_min") || "").trim();
  const bpmMaxRaw = String(formData.get("bpm_max") || "").trim();

  const narrativeBrief = String(
    formData.get("narrative_brief") || ""
  ).trim();

  if (!projectId) {
    throw new Error("Projeto inválido.");
  }

  if (!name) {
    throw new Error("Informe o nome do projeto.");
  }

  const targetDuration = targetDurationRaw
    ? Number(targetDurationRaw)
    : null;

  const bpmMin = bpmMinRaw ? Number(bpmMinRaw) : null;
  const bpmMax = bpmMaxRaw ? Number(bpmMaxRaw) : null;

  if (
    targetDuration !== null &&
    (!Number.isFinite(targetDuration) || targetDuration <= 0)
  ) {
    throw new Error("A duração precisa ser maior que zero.");
  }

  if (
    bpmMin !== null &&
    (!Number.isFinite(bpmMin) || bpmMin < 40 || bpmMin > 250)
  ) {
    throw new Error("O BPM mínimo deve estar entre 40 e 250.");
  }

  if (
    bpmMax !== null &&
    (!Number.isFinite(bpmMax) || bpmMax < 40 || bpmMax > 250)
  ) {
    throw new Error("O BPM máximo deve estar entre 40 e 250.");
  }

  if (bpmMin !== null && bpmMax !== null && bpmMin > bpmMax) {
    throw new Error("O BPM mínimo não pode ser maior que o BPM máximo.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { error } = await supabase
    .from("set_projects")
    .update({
      name,
      description: description || null,
      target_duration_minutes: targetDuration,
      bpm_min: bpmMin,
      bpm_max: bpmMax,
      narrative_brief: narrativeBrief || null,
    })
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
  revalidatePath(`/app/projetos/${projectId}`);
}

function normalizeTrackRelation(relation: unknown): ScoreTrack | null {
  const track = Array.isArray(relation) ? relation[0] : relation;

  if (!track || typeof track !== "object") return null;

  const record = track as Record<string, unknown>;

  if (typeof record.id !== "string" || typeof record.title !== "string") {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    artist: typeof record.artist === "string" ? record.artist : null,
    bpm: typeof record.bpm === "number" ? record.bpm : null,
    musical_key:
      typeof record.musical_key === "string" ? record.musical_key : null,
    energy: typeof record.energy === "number" ? record.energy : null,
    mood: typeof record.mood === "string" ? record.mood : null,
  };
}

function contextFromMoment(
  moment: unknown
): ScoreTracklistItemContext | null {
  return {
    curatorial_moment:
      typeof moment === "string" ? (moment as CuratorialMoment) : null,
  };
}

/**
 * Gera automaticamente a ordem da tracklist: aprova todas as candidatas
 * pendentes e reordena TODAS as tracks do projeto (candidatas + já
 * aprovadas) usando compatibilidade de harmonia, energia, BPM, mood e
 * diversidade — a mesma lógica de score já exibida na tela. Blocos
 * congelados mantêm a ordem interna; só a posição do bloco no set pode
 * mudar. Não é uma otimização global, é uma heurística gulosa
 * (nearest-neighbor) — determinística e auditável pelos scores mostrados
 * depois na tela.
 */
export async function autoOrganizeTracklist(projectId: string) {
  const { supabase, userId } = await requireAuth();

  if (!projectId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { data: projectRow } = await supabase
    .from("set_projects")
    .select("scoring_weights")
    .eq("id", projectId)
    .single();

  const scoringWeights = normalizeScoringWeights(projectRow?.scoring_weights);

  const { data: existingItemsRaw, error: itemsError } = await supabase
    .from("set_tracklist_items")
    .select(
      `
      id,
      track_id,
      block_id,
      curatorial_moment,
      tracks ( id, title, artist, bpm, musical_key, energy, mood )
    `
    )
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const { data: candidatesRaw, error: candidatesError } = await supabase
    .from("set_candidates")
    .select(
      `
      id,
      track_id,
      tracks ( id, title, artist, bpm, musical_key, energy, mood )
    `
    )
    .eq("project_id", projectId);

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  type ExistingRow = {
    id: string;
    track_id: string;
    block_id: string | null;
    curatorial_moment: unknown;
    track: ScoreTrack;
  };

  type RawExistingRow = Omit<ExistingRow, "track"> & { track: ScoreTrack | null };

  const existingRows: ExistingRow[] = (existingItemsRaw ?? [])
    .map(
      (row): RawExistingRow => ({
        id: row.id as string,
        track_id: row.track_id as string,
        block_id: (row.block_id ?? null) as string | null,
        curatorial_moment: row.curatorial_moment,
        track: normalizeTrackRelation(row.tracks),
      })
    )
    .filter((row): row is ExistingRow => row.track !== null);

  const existingTrackIds = new Set(existingRows.map((row) => row.track_id));

  const units: SequenceUnit[] = [];

  let index = 0;
  while (index < existingRows.length) {
    const row = existingRows[index];

    if (row.block_id) {
      const blockId = row.block_id;
      const members: ExistingRow[] = [];

      while (index < existingRows.length && existingRows[index].block_id === blockId) {
        members.push(existingRows[index]);
        index += 1;
      }

      const first = members[0];
      const last = members[members.length - 1];

      units.push({
        key: `existing-block:${blockId}`,
        entryTrack: first.track,
        exitTrack: last.track,
        entryContext: contextFromMoment(first.curatorial_moment),
        exitContext: contextFromMoment(last.curatorial_moment),
        members: members.map((member) => ({
          kind: "existing" as const,
          itemId: member.id,
        })),
      });
    } else {
      units.push({
        key: `existing-item:${row.id}`,
        entryTrack: row.track,
        exitTrack: row.track,
        entryContext: contextFromMoment(row.curatorial_moment),
        exitContext: contextFromMoment(row.curatorial_moment),
        members: [{ kind: "existing" as const, itemId: row.id }],
      });
      index += 1;
    }
  }

  const candidateRows = (candidatesRaw ?? [])
    .map((row) => ({
      track_id: row.track_id as string,
      track: normalizeTrackRelation(row.tracks),
    }))
    .filter(
      (row): row is { track_id: string; track: ScoreTrack } =>
        row.track !== null && !existingTrackIds.has(row.track_id)
    );

  for (const candidate of candidateRows) {
    units.push({
      key: `new:${candidate.track_id}`,
      entryTrack: candidate.track,
      exitTrack: candidate.track,
      entryContext: null,
      exitContext: null,
      members: [{ kind: "new" as const, trackId: candidate.track_id }],
    });
  }

  if (units.length < 2) {
    throw new Error(
      "São necessárias pelo menos 2 tracks (candidatas ou já aprovadas) para organizar automaticamente."
    );
  }

  const sequence = buildAutoSequence(units, scoringWeights);
  const flatMembers = sequence.flatMap((unit) => unit.members);

  // Fase 1: joga todos os items existentes para posições negativas
  // temporárias, liberando todo o espaço positivo de posição (que tem
  // UNIQUE(project_id, position)) sem colidir com ninguém.
  for (let i = 0; i < existingRows.length; i += 1) {
    const { error } = await supabase
      .from("set_tracklist_items")
      .update({ position: -(i + 1) })
      .eq("id", existingRows[i].id)
      .eq("project_id", projectId);

    if (error) {
      throw new Error(error.message);
    }
  }

  // Fase 2: insere as candidatas aprovadas agora, direto na posição final.
  // O espaço positivo está livre (fase 1), então não há colisão.
  for (let i = 0; i < flatMembers.length; i += 1) {
    const member = flatMembers[i];

    if (member.kind === "new") {
      const { error } = await supabase.from("set_tracklist_items").insert({
        project_id: projectId,
        track_id: member.trackId,
        position: i + 1,
      });

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  revalidatePath(`/app/projetos/${projectId}`);

  const newCount = flatMembers.filter((member) => member.kind === "new").length;
  const blockCount = sequence.filter((unit) => unit.members.length > 1).length;

  return {
    totalCount: flatMembers.length,
    newCount,
    existingCount: flatMembers.length - newCount,
    blockCount,
  };
}

type VersionSnapshot = {
  version: 1;
  blocks: { tempId: string; name: string }[];
  items: {
    track_id: string;
    position: number;
    curatorial_moment: string | null;
    curatorial_intent: string | null;
    block_temp_id: string | null;
  }[];
};

/**
 * Salva um snapshot da tracklist atual (tracks, ordem, blocos congelados e
 * momentos curatoriais) como uma versão nomeada. Candidatas não entram no
 * snapshot — só o que já está aprovado na tracklist.
 */
export async function saveSetVersion(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const name = String(formData.get("name") || "").trim();

  if (!projectId) {
    throw new Error("Dados inválidos.");
  }

  if (!name) {
    throw new Error("Dê um nome para a versão.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { data: items, error: itemsError } = await supabase
    .from("set_tracklist_items")
    .select(
      `
      track_id,
      position,
      curatorial_moment,
      curatorial_intent,
      block_id,
      set_blocks ( name )
    `
    )
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  if (!items || items.length === 0) {
    throw new Error("A tracklist está vazia — não há nada para salvar como versão.");
  }

  const blockNameById = new Map<string, string>();

  for (const item of items) {
    if (!item.block_id) continue;
    const blockRel = item.set_blocks as unknown;
    const blockObj = Array.isArray(blockRel) ? blockRel[0] : blockRel;
    const name =
      blockObj && typeof blockObj === "object" && "name" in blockObj
        ? (blockObj as { name: unknown }).name
        : null;
    if (typeof name === "string") {
      blockNameById.set(item.block_id, name);
    }
  }

  const snapshot: VersionSnapshot = {
    version: 1,
    blocks: [...blockNameById.entries()].map(([tempId, blockName]) => ({
      tempId,
      name: blockName,
    })),
    items: items.map((item) => ({
      track_id: item.track_id,
      position: item.position,
      curatorial_moment: item.curatorial_moment,
      curatorial_intent: item.curatorial_intent,
      block_temp_id: item.block_id,
    })),
  };

  const { error } = await supabase.from("set_versions").insert({
    project_id: projectId,
    name,
    snapshot,
  });

  if (error) {
    throw new Error(error.message);
  }

  await logCurationEvent(supabase, userId, projectId, "set_version_saved", { name });

  revalidatePath(`/app/projetos/${projectId}`);
}

/**
 * Restaura uma versão salva: substitui a tracklist e os blocos atuais pelo
 * conteúdo do snapshot. Candidatas não são afetadas. Tracks que não existem
 * mais na biblioteca (excluídas depois que a versão foi salva) são
 * silenciosamente ignoradas na restauração, em vez de derrubar a operação
 * inteira.
 */
export async function restoreSetVersion(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const versionId = String(formData.get("version_id") || "");

  if (!projectId || !versionId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { data: version, error: versionError } = await supabase
    .from("set_versions")
    .select("snapshot")
    .eq("id", versionId)
    .eq("project_id", projectId)
    .single();

  if (versionError || !version) {
    throw new Error("Versão não encontrada.");
  }

  const snapshot = version.snapshot as VersionSnapshot;

  const { error: deleteItemsError } = await supabase
    .from("set_tracklist_items")
    .delete()
    .eq("project_id", projectId);

  if (deleteItemsError) {
    throw new Error(deleteItemsError.message);
  }

  const { error: deleteBlocksError } = await supabase
    .from("set_blocks")
    .delete()
    .eq("project_id", projectId);

  if (deleteBlocksError) {
    throw new Error(deleteBlocksError.message);
  }

  const blockIdMap = new Map<string, string>();

  for (const block of snapshot.blocks ?? []) {
    const { data: newBlock, error: blockError } = await supabase
      .from("set_blocks")
      .insert({ project_id: projectId, name: block.name })
      .select("id")
      .single();

    if (blockError || !newBlock) {
      throw new Error(blockError?.message || "Erro ao restaurar bloco.");
    }

    blockIdMap.set(block.tempId, newBlock.id);
  }

  const trackIds = [...new Set((snapshot.items ?? []).map((item) => item.track_id))];

  const { data: existingTracks, error: tracksError } = await supabase
    .from("tracks")
    .select("id")
    .eq("user_id", userId)
    .in("id", trackIds.length > 0 ? trackIds : ["00000000-0000-0000-0000-000000000000"]);

  if (tracksError) {
    throw new Error(tracksError.message);
  }

  const existingTrackIdSet = new Set((existingTracks ?? []).map((track) => track.id));

  const rowsToInsert = (snapshot.items ?? [])
    .filter((item) => existingTrackIdSet.has(item.track_id))
    .map((item, index) => ({
      project_id: projectId,
      track_id: item.track_id,
      position: index + 1,
      curatorial_moment: item.curatorial_moment,
      curatorial_intent: item.curatorial_intent,
      block_id: item.block_temp_id
        ? blockIdMap.get(item.block_temp_id) ?? null
        : null,
    }));

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("set_tracklist_items")
      .insert(rowsToInsert);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  await logCurationEvent(supabase, userId, projectId, "set_version_restored", {
    version_id: versionId,
    restored_count: rowsToInsert.length,
  });

  revalidatePath(`/app/projetos/${projectId}`);

  return {
    restoredCount: rowsToInsert.length,
    skippedCount: (snapshot.items ?? []).length - rowsToInsert.length,
  };
}

export async function deleteSetVersion(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const versionId = String(formData.get("version_id") || "");

  if (!projectId || !versionId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { error } = await supabase
    .from("set_versions")
    .delete()
    .eq("id", versionId)
    .eq("project_id", projectId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/app/projetos/${projectId}`);
}

/**
 * Registra a decisão humana (aprovar/rejeitar, com justificativa opcional)
 * sobre uma transição específica entre duas tracks da tracklist. Resolve
 * from/to por track_id -> candidata do projeto, já que approved_transitions
 * referencia set_candidates, não set_tracklist_items diretamente.
 */
export async function recordTransitionDecision(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const fromTrackId = String(formData.get("from_track_id") || "");
  const toTrackId = String(formData.get("to_track_id") || "");
  const decision = String(formData.get("decision") || "");
  const explanation = String(formData.get("explanation") || "").trim();

  if (!projectId || !fromTrackId || !toTrackId) {
    throw new Error("Dados inválidos.");
  }

  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("Decisão inválida.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { data: candidateRows, error: candidateError } = await supabase
    .from("set_candidates")
    .select("id, track_id")
    .eq("project_id", projectId)
    .in("track_id", [fromTrackId, toTrackId]);

  if (candidateError) {
    throw new Error(candidateError.message);
  }

  const fromCandidate = candidateRows?.find((row) => row.track_id === fromTrackId);
  const toCandidate = candidateRows?.find((row) => row.track_id === toTrackId);

  if (!fromCandidate || !toCandidate) {
    throw new Error(
      "Não foi possível localizar as candidatas dessa transição (a track pode ter sido removida do projeto)."
    );
  }

  const { error } = await supabase.from("approved_transitions").upsert(
    {
      project_id: projectId,
      from_candidate_id: fromCandidate.id,
      to_candidate_id: toCandidate.id,
      status: decision,
      explanation: explanation || null,
    },
    { onConflict: "project_id,from_candidate_id,to_candidate_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  await logCurationEvent(
    supabase,
    userId,
    projectId,
    decision === "approved" ? "transition_approved" : "transition_rejected",
    { from_track_id: fromTrackId, to_track_id: toTrackId, explanation: explanation || null },
    fromCandidate.id
  );

  revalidatePath(`/app/projetos/${projectId}`);
}

export async function clearTransitionDecision(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");
  const fromTrackId = String(formData.get("from_track_id") || "");
  const toTrackId = String(formData.get("to_track_id") || "");

  if (!projectId || !fromTrackId || !toTrackId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const { data: candidateRows, error: candidateError } = await supabase
    .from("set_candidates")
    .select("id, track_id")
    .eq("project_id", projectId)
    .in("track_id", [fromTrackId, toTrackId]);

  if (candidateError) {
    throw new Error(candidateError.message);
  }

  const fromCandidate = candidateRows?.find((row) => row.track_id === fromTrackId);
  const toCandidate = candidateRows?.find((row) => row.track_id === toTrackId);

  if (!fromCandidate || !toCandidate) {
    return;
  }

  const { error } = await supabase
    .from("approved_transitions")
    .delete()
    .eq("project_id", projectId)
    .eq("from_candidate_id", fromCandidate.id)
    .eq("to_candidate_id", toCandidate.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/app/projetos/${projectId}`);
}

/**
 * Reordena a tracklist a partir de uma lista completa de IDs de item já na
 * ordem final desejada (usado pelo drag-and-drop no cliente). Reaproveita
 * o mesmo truque de posições negativas temporárias que moveEntityUp/Down já
 * usam, via applyNewOrder.
 */
export async function reorderTracklist(
  projectId: string,
  orderedItemIds: string[]
) {
  const { supabase, userId } = await requireAuth();

  if (!projectId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const newOrderArray = orderedItemIds.map((itemId, index) => ({
    id: itemId,
    newPosition: index + 1,
  }));

  await applyNewOrder(supabase, projectId, newOrderArray);

  revalidatePath(`/app/projetos/${projectId}`);
}

const SCORING_FACTOR_KEYS = [
  "narrative",
  "timing",
  "harmony",
  "energy",
  "mood",
  "bpm",
  "diversity",
] as const;

export async function updateScoringWeights(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");

  if (!projectId) {
    throw new Error("Dados inválidos.");
  }

  await ensureProjectOwnership(supabase, projectId, userId);

  const weights: Record<string, number> = {};

  for (const key of SCORING_FACTOR_KEYS) {
    const raw = formData.get(key);
    const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;

    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`Peso de "${key}" inválido — use um número entre 0 e 100.`);
    }

    weights[key] = value;
  }

  const { error } = await supabase
    .from("set_projects")
    .update({ scoring_weights: weights })
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/app/projetos/${projectId}`);
}

/**
 * Registra um evento na timeline de curadoria do projeto. Nunca derruba a
 * ação principal se falhar — é um registro auxiliar, não uma etapa crítica
 * do fluxo. Chamado a partir de outras actions deste arquivo.
 */
async function logCurationEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
  eventType:
    | "track_included"
    | "track_removed"
    | "track_moved"
    | "block_frozen"
    | "block_unfrozen"
    | "transition_approved"
    | "transition_rejected"
    | "set_version_saved"
    | "set_version_restored",
  payload: Record<string, unknown> = {},
  candidateId?: string
) {
  try {
    await supabase.from("curation_events").insert({
      user_id: userId,
      project_id: projectId,
      candidate_id: candidateId ?? null,
      event_type: eventType,
      payload,
    });
  } catch {
    // silencioso de propósito — timeline é auxiliar, não pode quebrar o fluxo principal
  }
}
