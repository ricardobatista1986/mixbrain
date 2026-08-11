"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ParsedTrackInput = {
  title: string;
  artist: string;
  bpm: number | null;
  musicalKey: string | null;
  energy: number | null;
  mood: string | null;
  source: string | null;
  notes: string | null;
};

function parseTrackFormData(formData: FormData): ParsedTrackInput {
  const rawTitle = formData.get("title");
  const rawArtist = formData.get("artist");
  const rawBpm = formData.get("bpm");
  const rawKey = formData.get("musicalKey");
  const rawEnergy = formData.get("energy");
  const rawMood = formData.get("mood");
  const rawSource = formData.get("source");
  const rawNotes = formData.get("notes");

  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  const artist = typeof rawArtist === "string" ? rawArtist.trim() : "";
  const musicalKey = typeof rawKey === "string" ? rawKey.trim() : "";
  const mood = typeof rawMood === "string" ? rawMood.trim() : "";
  const source = typeof rawSource === "string" ? rawSource.trim() : "";
  const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";

  const bpm =
    typeof rawBpm === "string" && rawBpm.trim() !== ""
      ? Number(rawBpm)
      : null;

  const energy =
    typeof rawEnergy === "string" && rawEnergy.trim() !== ""
      ? Number(rawEnergy)
      : null;

  if (!title) {
    throw new Error("O título da track é obrigatório.");
  }

  if (!artist) {
    throw new Error("O artista da track é obrigatório.");
  }

  if (bpm !== null && (!Number.isFinite(bpm) || bpm <= 0)) {
    throw new Error("O BPM deve ser um número positivo.");
  }

  if (
    energy !== null &&
    (!Number.isFinite(energy) || !Number.isInteger(energy) || energy < 1 || energy > 10)
  ) {
    throw new Error("A energia deve ser um número inteiro entre 1 e 10.");
  }

  return {
    title,
    artist,
    bpm,
    musicalKey: musicalKey || null,
    energy,
    mood: mood || null,
    source: source || null,
    notes: notes || null,
  };
}

export async function createTrack(formData: FormData) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

  const parsed = parseTrackFormData(formData);

  const { error } = await supabase.from("tracks").insert({
    user_id: claims.sub,
    title: parsed.title,
    artist: parsed.artist,
    bpm: parsed.bpm,
    musical_key: parsed.musicalKey,
    energy: parsed.energy,
    mood: parsed.mood,
    source: parsed.source,
    notes: parsed.notes,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/tracks");
}

export async function updateTrack(trackId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

  if (!trackId) {
    throw new Error("Track inválida.");
  }

  const parsed = parseTrackFormData(formData);

  const { error } = await supabase
    .from("tracks")
    .update({
      title: parsed.title,
      artist: parsed.artist,
      bpm: parsed.bpm,
      musical_key: parsed.musicalKey,
      energy: parsed.energy,
      mood: parsed.mood,
      source: parsed.source,
      notes: parsed.notes,
    })
    .eq("id", trackId)
    .eq("user_id", claims.sub);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/tracks");
  revalidatePath("/app");
}

export async function deleteTrack(trackId: string) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

  if (!trackId) {
    throw new Error("Track inválida.");
  }

  // tracks.id tem ON DELETE CASCADE em set_candidates, set_tracklist_items e
  // track_features. Ou seja, excluir a track aqui a remove automaticamente de
  // qualquer projeto onde ela seja candidata ou esteja aprovada na tracklist.
  const { error, count } = await supabase
    .from("tracks")
    .delete({ count: "exact" })
    .eq("id", trackId)
    .eq("user_id", claims.sub);

  if (error) {
    throw new Error(error.message);
  }

  if (!count) {
    throw new Error("Track não encontrada ou sem permissão para excluir.");
  }

  revalidatePath("/app/tracks");
  revalidatePath("/app");
}