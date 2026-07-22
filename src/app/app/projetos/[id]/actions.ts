"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath(`/app/projetos/${projectId}`);
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

  revalidatePath(`/app/projetos/${projectId}`);
}