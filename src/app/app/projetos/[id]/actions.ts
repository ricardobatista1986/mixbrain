"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("set_candidates").insert({
    project_id: projectId,
    track_id: trackId,
    notes: notes || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/app/projetos/${projectId}`);
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

export async function updateSetProject(formData: FormData) {
  const { supabase, userId } = await requireAuth();

  const projectId = String(formData.get("project_id") || "");

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
