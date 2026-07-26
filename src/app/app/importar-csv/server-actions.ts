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

    const batches = chunkArray(sanitizedRows, 500);

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
      message: `${sanitizedRows.length} track(s) importada(s) com sucesso.`,
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