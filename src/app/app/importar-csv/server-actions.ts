"use server";

import { createClient } from "@/lib/supabase/server";

type ImportRow = {
  title: string;
  artist: string | null;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
  notes: string | null;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function makeTrackKey(title: string, artist: string | null) {
  return `${title.trim().toLowerCase()}::${(artist ?? "").trim().toLowerCase()}`;
}

export async function importTracksFromCsv(rows: ImportRow[]) {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getClaims();

    const userId = authData?.claims?.sub;

    if (!userId) {
      return {
        ok: false,
        message: "Usuário não autenticado.",
      };
    }

    if (!rows || rows.length === 0) {
      return {
        ok: false,
        message: "Nenhuma linha recebida para importação.",
      };
    }

    const sanitizedRows = rows
      .filter((row) => row.title && row.title.trim().length > 0)
      .map((row) => ({
        user_id: userId,
        title: row.title.trim(),
        artist: row.artist?.trim() || null,
        bpm: row.bpm,
        musical_key: row.musical_key?.trim() || null,
        energy: row.energy,
        mood: row.mood?.trim() || null,
        notes: row.notes?.trim() || null,
      }));

    if (sanitizedRows.length === 0) {
      return {
        ok: false,
        message: "Nenhuma track válida sobrou após sanitização.",
      };
    }

    const { data: existingTracks, error: existingError } = await supabase
      .from("tracks")
      .select("title, artist")
      .eq("user_id", userId);

    if (existingError) {
      return {
        ok: false,
        message: `Erro ao consultar biblioteca existente: ${existingError.message}`,
      };
    }

    const existingKeys = new Set(
      (existingTracks ?? []).map((track) => makeTrackKey(track.title, track.artist))
    );

    const rowsToInsert = sanitizedRows.filter(
      (row) => !existingKeys.has(makeTrackKey(row.title, row.artist))
    );

    const ignoredCount = sanitizedRows.length - rowsToInsert.length;

    if (rowsToInsert.length === 0) {
      return {
        ok: true,
        message:
          ignoredCount > 0
            ? `Nenhuma track nova foi importada. ${ignoredCount} já existia(m) na biblioteca.`
            : "Nenhuma track nova foi importada.",
      };
    }

    const batches = chunkArray(rowsToInsert, 500);

    for (const batch of batches) {
      const { error } = await supabase.from("tracks").insert(batch);

      if (error) {
        return {
          ok: false,
          message: `Erro ao importar lote: ${error.message}`,
        };
      }
    }

    return {
      ok: true,
      message: `${rowsToInsert.length} track(s) importada(s) com sucesso. ${ignoredCount} linha(s) já existiam e foram ignoradas.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Erro inesperado na importação CSV.",
    };
  }
}