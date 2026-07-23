"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ==========================================
// FUNÇÃO AUXILIAR NOVA
// ==========================================
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

// ==========================================
// SUAS FUNÇÕES QUE JÁ EXISTIAM
// ==========================================
export async function updateSetProject(projectId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims) {
    throw new Error("Usuário não autenticado.");
  }

  const rawName = formData.get("name");
  const rawDescription = formData.get("description");
  const rawTargetDuration = formData.get("targetDurationMinutes");
  const rawBpmMin = formData.get("bpmMin");
  const rawBpmMax = formData.get("bpmMax");
  const rawNarrativeBrief = formData.get("narrativeBrief");

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const description =
    typeof rawDescription === "string" ? rawDescription.trim() : "";
  const narrativeBrief =
    typeof rawNarrativeBrief === "string" ? rawNarrativeBrief.trim() : "";

  const targetDurationMinutes =
    typeof rawTargetDuration === "string" && rawTargetDuration.trim() !== ""
      ? Number(rawTargetDuration)
      : null;

  const bpmMin =
    typeof rawBpmMin === "string" && rawBpmMin.trim() !== ""
      ? Number(rawBpmMin)
      : null;

  const bpmMax =
    typeof rawBpmMax === "string" && rawBpmMax.trim() !== ""
      ? Number(rawBpmMax)
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

  if (bpmMin !== null && (!Number.isFinite(bpmMin) || bpmMin < 40 || bpmMin > 250)) {
    throw new Error("O BPM mínimo deve estar entre 40 e 250.");
  }

  if (bpmMax !== null && (!Number.isFinite(bpmMax) || bpmMax < 40 || bpmMax > 250)) {
    throw new Error("O BPM máximo deve estar entre 40 e 250.");
  }

  if (bpmMin !== null && bpmMax !== null && bpmMin > bpmMax) {
    throw new Error("O BPM mínimo não pode ser maior que o BPM máximo.");
  }

  const { error } = await supabase
    .from("set_projects")
    .update({
      name,
      description: description || null,
      target_duration_minutes: targetDurationMinutes,
      bpm_min: bpmMin,
      bpm_max: bpmMax,
      narrative_brief: narrativeBrief || null,
    })
    .eq("id", projectId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
  revalidatePath(`/app/projects/${projectId}`);
}

export async function addCandidate(projectId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

  const rawTrackId = formData.get("trackId");
  const rawNotes = formData.get("notes");

  const trackId = typeof rawTrackId === "string" ? rawTrackId.trim() : "";
  const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";

  if (!trackId) {
    throw new Error("Selecione uma track.");
  }

  const { error } = await supabase.from("set_candidates").insert({
    project_id: projectId,
    track_id: trackId,
    user_id: claims.sub,
    status: "candidate",
    notes: notes || null,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Esta track já foi adicionada como candidata.");
    }
    throw new Error(error.message);
  }

  revalidatePath(`/app/projects/${projectId}`);
}

// ==========================================
// NOVAS FUNÇÕES DA TRACKLIST
// ==========================================
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

    const { error } = await supabase.from("set_tracklist_items").insert({
      project_id: projectId,
      track_id: trackId,
      position: nextPosition,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath(`/app/projects/${projectId}`);
}

export async function removeFromTracklist(formData: FormData) {
  const projectId = String(formData.get("project_id") || "");
  const tracklistItemId = String(formData.get("tracklist_item_id") || "");

  const { supabase } = await requireUserAndProject(projectId);

  const { data: item, error: itemError } = await supabase
    .from("set_tracklist_items")
    .select("id, position")
    .eq("id", tracklistItemId)
    .eq("project_id", projectId)
    .single();

  if (itemError || !item) {
    throw new Error("Item da tracklist não encontrado.");
  }

  const { error: deleteError } = await supabase
    .from("set_tracklist_items")
    .delete()
    .eq("id", tracklistItemId)
    .eq("project_id", projectId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { data: itemsAfter } = await supabase
    .from("set_tracklist_items")
    .select("id, position")
    .eq("project_id", projectId)
    .gt("position", item.position)
    .order("position", { ascending: true });

  if (itemsAfter && itemsAfter.length > 0) {
    for (const row of itemsAfter) {
      const { error } = await supabase
        .from("set_tracklist_items")
        .update({ position: row.position - 1 })
        .eq("id", row.id);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  revalidatePath(`/app/projects/${projectId}`);
}

export async function moveTracklistItemUp(formData: FormData) {
  const projectId = String(formData.get("project_id") || "");
  const tracklistItemId = String(formData.get("tracklist_item_id") || "");

  const { supabase } = await requireUserAndProject(projectId);

  const { data: current, error: currentError } = await supabase
    .from("set_tracklist_items")
    .select("id, position")
    .eq("id", tracklistItemId)
    .eq("project_id", projectId)
    .single();

  if (currentError || !current) {
    throw new Error("Item da tracklist não encontrado.");
  }

  if (current.position <= 1) {
    revalidatePath(`/app/projects/${projectId}`);
    return;
  }

  const targetPosition = current.position - 1;

  const { data: previous, error: previousError } = await supabase
    .from("set_tracklist_items")
    .select("id, position")
    .eq("project_id", projectId)
    .eq("position", targetPosition)
    .single();

  if (previousError || !previous) {
    throw new Error("Item anterior não encontrado.");
  }

  const { error: firstUpdateError } = await supabase
    .from("set_tracklist_items")
    .update({ position: 0 })
    .eq("id", previous.id);

  if (firstUpdateError) {
    throw new Error(firstUpdateError.message);
  }

  const { error: secondUpdateError } = await supabase
    .from("set_tracklist_items")
    .update({ position: targetPosition })
    .eq("id", current.id);

  if (secondUpdateError) {
    throw new Error(secondUpdateError.message);
  }

  const { error: thirdUpdateError } = await supabase
    .from("set_tracklist_items")
    .update({ position: current.position })
    .eq("id", previous.id);

  if (thirdUpdateError) {
    throw new Error(thirdUpdateError.message);
  }

  revalidatePath(`/app/projects/${projectId}`);
}

export async function moveTracklistItemDown(formData: FormData) {
  const projectId = String(formData.get("project_id") || "");
  const tracklistItemId = String(formData.get("tracklist_item_id") || "");

  const { supabase } = await requireUserAndProject(projectId);

  const { data: current, error: currentError } = await supabase
    .from("set_tracklist_items")
    .select("id, position")
    .eq("id", tracklistItemId)
    .eq("project_id", projectId)
    .single();

  if (currentError || !current) {
    throw new Error("Item da tracklist não encontrado.");
  }

  const { data: next, error: nextError } = await supabase
    .from("set_tracklist_items")
    .select("id, position")
    .eq("project_id", projectId)
    .eq("position", current.position + 1)
    .maybeSingle();

  if (nextError) {
    throw new Error(nextError.message);
  }

  if (!next) {
    revalidatePath(`/app/projects/${projectId}`);
    return;
  }

  const { error: firstUpdateError } = await supabase
    .from("set_tracklist_items")
    .update({ position: 0 })
    .eq("id", next.id);

  if (firstUpdateError) {
    throw new Error(firstUpdateError.message);
  }

  const { error: secondUpdateError } = await supabase
    .from("set_tracklist_items")
    .update({ position: current.position + 1 })
    .eq("id", current.id);

  if (secondUpdateError) {
    throw new Error(secondUpdateError.message);
  }

  const { error: thirdUpdateError } = await supabase
    .from("set_tracklist_items")
    .update({ position: current.position })
    .eq("id", next.id);

  if (thirdUpdateError) {
    throw new Error(thirdUpdateError.message);
  }

  revalidatePath(`/app/projects/${projectId}`);
}