"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUserAndProject(projectId: string) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims?.sub) {
    throw new Error("Usuário não autenticado.");
  }

  const userId = claims.sub;

  const { data: project, error } = await supabase
    .from("set_projects")
    .select("id, user_id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error || !project) {
    throw new Error("Projeto não encontrado.");
  }

  return { supabase, userId, project };
}

// Helper seguro para reordenar múltiplos itens sem violar restrições do banco
async function applyNewOrder(supabase: any, projectId: string, newOrderArray: any[]) {
  // Passo 1: joga todas as posições para negativo (evita conflito de posição única)
  for (const item of newOrderArray) {
    await supabase.from("set_tracklist_items").update({ position: -item.newPosition }).eq("id", item.id);
  }
  // Passo 2: consolida a posição correta positiva
  for (const item of newOrderArray) {
    await supabase.from("set_tracklist_items").update({ position: item.newPosition }).eq("id", item.id);
  }
}

export async function updateSetProject(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) throw new Error("Usuário não autenticado.");

  const rawName = formData.get("name");
  const rawDescription = formData.get("description");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const description = typeof rawDescription === "string" ? rawDescription.trim() : "";

  if (!name) throw new Error("O nome é obrigatório.");

  const { error } = await supabase
    .from("set_projects")
    .update({ name, description: description || null })
    .eq("id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath("/app");
  revalidatePath(`/app/projetos/${projectId}`);
}

export async function addCandidate(projectId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims?.sub) throw new Error("Não autenticado.");

  const trackId = String(formData.get("trackId") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!trackId) throw new Error("Selecione uma track.");

  const { error } = await supabase.from("set_candidates").insert({
    project_id: projectId,
    track_id: trackId,
    user_id: authData.claims.sub,
    status: "candidate",
    notes: notes || null,
  });

  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath(`/app/projetos/${projectId}`);
}

export async function approveCandidateToTracklist(formData: FormData) {
  const projectId = String(formData.get("project_id") || "");
  const trackId = String(formData.get("track_id") || "");

  const { supabase } = await requireUserAndProject(projectId);

  const { data: existing } = await supabase
    .from("set_tracklist_items")
    .select("id")
    .eq("project_id", projectId)
    .eq("track_id", trackId)
    .maybeSingle();

  if (!existing) {
    const { data: lastItem } = await supabase
      .from("set_tracklist_items")
      .select("position")
      .eq("project_id", projectId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextPosition = lastItem ? lastItem.position + 1 : 1;

    await supabase.from("set_tracklist_items").insert({
      project_id: projectId,
      track_id: trackId,
      position: nextPosition,
    });
  }
  revalidatePath(`/app/projetos/${projectId}`);
}

export async function removeFromTracklist(formData: FormData) {
  const projectId = String(formData.get("project_id") || "");
  const tracklistItemId = String(formData.get("tracklist_item_id") || "");

  const { supabase } = await requireUserAndProject(projectId);

  const { data: item } = await supabase
    .from("set_tracklist_items")
    .select("id, position")
    .eq("id", tracklistItemId)
    .single();

  if (!item) return;

  await supabase.from("set_tracklist_items").delete().eq("id", tracklistItemId);

  const { data: itemsAfter } = await supabase
    .from("set_tracklist_items")
    .select("id, position")
    .eq("project_id", projectId)
    .gt("position", item.position)
    .order("position", { ascending: true });

  if (itemsAfter) {
    for (const row of itemsAfter) {
      await supabase.from("set_tracklist_items").update({ position: row.position - 1 }).eq("id", row.id);
    }
  }
  revalidatePath(`/app/projetos/${projectId}`);
}

export async function createFrozenBlock(formData: FormData) {
  const projectId = String(formData.get("project_id") || "");
  const blockName = String(formData.get("block_name") || "Novo Bloco");
  const selectedItemIds = formData.getAll("selected_items").map(String);

  if (selectedItemIds.length < 2) {
    throw new Error("Selecione pelo menos 2 tracks para formar um bloco.");
  }

  const { supabase } = await requireUserAndProject(projectId);

  const { data: items } = await supabase
    .from("set_tracklist_items")
    .select("id, position, block_id")
    .in("id", selectedItemIds)
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (!items || items.length !== selectedItemIds.length) throw new Error("Erro ao validar tracks.");
  
  if (items.some((i) => i.block_id)) throw new Error("Alguma track já pertence a um bloco.");

  for (let i = 1; i < items.length; i++) {
    if (items[i].position !== items[i - 1].position + 1) {
      throw new Error("As tracks selecionadas precisam estar em sequência exata na lista.");
    }
  }

  const { data: block } = await supabase
    .from("set_blocks")
    .insert({ project_id: projectId, name: blockName })
    .select("id")
    .single();

  if (block) {
    await supabase.from("set_tracklist_items").update({ block_id: block.id }).in("id", selectedItemIds);
  }
  revalidatePath(`/app/projetos/${projectId}`);
}

export async function dissolveFrozenBlock(formData: FormData) {
  const projectId = String(formData.get("project_id") || "");
  const blockId = String(formData.get("block_id") || "");
  const { supabase } = await requireUserAndProject(projectId);

  await supabase.from("set_tracklist_items").update({ block_id: null }).eq("block_id", blockId);
  await supabase.from("set_blocks").delete().eq("id", blockId);
  revalidatePath(`/app/projetos/${projectId}`);
}

export async function moveEntityUp(formData: FormData) {
  const projectId = String(formData.get("project_id") || "");
  const entityId = String(formData.get("entity_id") || "");
  const isBlock = formData.get("is_block") === "true";

  const { supabase } = await requireUserAndProject(projectId);

  const { data: allItems } = await supabase
    .from("set_tracklist_items")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (!allItems) return;

  const aStartIndex = isBlock ? allItems.findIndex((i) => i.block_id === entityId) : allItems.findIndex((i) => i.id === entityId);
  const aLength = isBlock ? allItems.filter((i) => i.block_id === entityId).length : 1;

  if (aStartIndex <= 0) return; // Já está no topo

  const bEndIndex = aStartIndex - 1;
  let bStartIndex = bEndIndex;
  const bBlockId = allItems[bEndIndex].block_id;

  if (bBlockId) {
    while (bStartIndex > 0 && allItems[bStartIndex - 1].block_id === bBlockId) {
      bStartIndex--;
    }
  }
  const bLength = bEndIndex - bStartIndex + 1;

  const arrayBefore = allItems.slice(0, bStartIndex);
  const arrayB = allItems.slice(bStartIndex, bStartIndex + bLength);
  const arrayA = allItems.slice(aStartIndex, aStartIndex + aLength);
  const arrayAfter = allItems.slice(aStartIndex + aLength);

  const newArray = [...arrayBefore, ...arrayA, ...arrayB, ...arrayAfter];
  const updates = newArray.map((item, index) => ({ id: item.id, newPosition: index + 1 }));

  await applyNewOrder(supabase, projectId, updates);
  revalidatePath(`/app/projetos/${projectId}`);
}

export async function moveEntityDown(formData: FormData) {
  const projectId = String(formData.get("project_id") || "");
  const entityId = String(formData.get("entity_id") || "");
  const isBlock = formData.get("is_block") === "true";

  const { supabase } = await requireUserAndProject(projectId);

  const { data: allItems } = await supabase
    .from("set_tracklist_items")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });

  if (!allItems) return;

  const aStartIndex = isBlock ? allItems.findIndex((i) => i.block_id === entityId) : allItems.findIndex((i) => i.id === entityId);
  const aLength = isBlock ? allItems.filter((i) => i.block_id === entityId).length : 1;

  if (aStartIndex === -1 || aStartIndex + aLength >= allItems.length) return; // Já está no fim

  const bStartIndex = aStartIndex + aLength;
  let bEndIndex = bStartIndex;
  const bBlockId = allItems[bStartIndex].block_id;

  if (bBlockId) {
    while (bEndIndex < allItems.length - 1 && allItems[bEndIndex + 1].block_id === bBlockId) {
      bEndIndex++;
    }
  }
  const bLength = bEndIndex - bStartIndex + 1;

  const arrayBefore = allItems.slice(0, aStartIndex);
  const arrayA = allItems.slice(aStartIndex, aStartIndex + aLength);
  const arrayB = allItems.slice(bStartIndex, bStartIndex + bLength);
  const arrayAfter = allItems.slice(bStartIndex + bLength);

  const newArray = [...arrayBefore, ...arrayB, ...arrayA, ...arrayAfter];
  const updates = newArray.map((item, index) => ({ id: item.id, newPosition: index + 1 }));

  await applyNewOrder(supabase, projectId, updates);
  revalidatePath(`/app/projetos/${projectId}`);
}