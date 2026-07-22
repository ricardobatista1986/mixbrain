"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTrack(formData: FormData) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

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

  const { error } = await supabase.from("tracks").insert({
    user_id: claims.sub,
    title,
    artist,
    bpm,
    musical_key: musicalKey || null,
    energy,
    mood: mood || null,
    source: source || null,
    notes: notes || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app/tracks");
}