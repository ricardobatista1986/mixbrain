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

type ImportProject = {
  id: string;
  name: string;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function makeTrackKey(title: string, artist: string) {
  return `${title.trim().toLocaleLowerCase()}::${artist
    .trim()
    .toLocaleLowerCase()}`;
}

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    throw new Error("Usuário não autenticado.");
  }

  return { supabase, userId };
}

export async function listImportProjects(): Promise<ImportProject[]> {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("set_projects")
      .select("id, name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as ImportProject[];
  } catch {
    return [];
  }
}

export async function importTracksFromCsv(rows: ImportRow[], projectId: string) {
  try {
    const { supabase, userId } = await requireUser();

    if (!projectId) {
      return {
        ok: false,
        message: "Selecione o projeto que receberá as candidatas.",
      };
    }

    const { data: project, error: projectError } = await supabase
      .from("set_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", userId)
      .maybeSingle();

    if (projectError || !project) {
      return {
        ok: false,
        message: "Projeto não encontrado ou sem acesso.",
      };
    }

    const uniqueRows = Array.from(
      new Map(
        rows
          .filter((row) => row.title?.trim() && row.artist?.trim())
          .map((row) => {
            const normalized = {
              ...row,
              title: row.title.trim(),
              artist: row.artist!.trim(),
            };

            return [
              makeTrackKey(normalized.title, normalized.artist),
              normalized,
            ] as const;
          })
      ).values()
    );

    if (!uniqueRows.length) {
      return {
        ok: false,
        message: "Nenhuma linha válida: título e artista são obrigatórios.",
      };
    }

    const { data: libraryRows, error: libraryError } = await supabase
      .from("tracks")
      .select("id, title, artist")
      .eq("user_id", userId);

    if (libraryError) {
      return {
        ok: false,
        message: `Erro ao consultar biblioteca: ${libraryError.message}`,
      };
    }

    const tracksByKey = new Map(
      (libraryRows ?? []).map((track) => [
        makeTrackKey(track.title, track.artist),
        track,
      ])
    );

    const toCreate = uniqueRows.filter(
      (row) => !tracksByKey.has(makeTrackKey(row.title, row.artist))
    );

    for (const batch of chunkArray(toCreate, 300)) {
      const { data: created, error } = await supabase
        .from("tracks")
        .insert(
          batch.map((row) => ({
            user_id: userId,
            title: row.title,
            artist: row.artist,
            bpm: row.bpm,
            musical_key: row.musical_key,
            energy: row.energy,
            mood: row.mood,
            notes: row.notes,
            source_name: "csv",
            source_imported_at: new Date().toISOString(),
          }))
        )
        .select("id, title, artist");

      if (error) {
        return {
          ok: false,
          message: `Erro ao criar tracks: ${error.message}`,
        };
      }

      for (const track of created ?? []) {
        tracksByKey.set(makeTrackKey(track.title, track.artist), track);
      }
    }

    const importedTrackIds = uniqueRows
      .map((row) => tracksByKey.get(makeTrackKey(row.title, row.artist))?.id)
      .filter((id): id is string => Boolean(id));

    const { data: candidateRows, error: candidateError } = await supabase
      .from("set_candidates")
      .select("track_id, sort_order")
      .eq("project_id", projectId);

    if (candidateError) {
      return {
        ok: false,
        message: `Tracks salvas, mas falhou ao consultar candidatas: ${candidateError.message}`,
      };
    }

    const existingCandidateIds = new Set(
      (candidateRows ?? []).map((candidate) => candidate.track_id)
    );
    const newCandidateIds = importedTrackIds.filter(
      (id) => !existingCandidateIds.has(id)
    );
    const maxSortOrder = (candidateRows ?? []).reduce(
      (max, candidate) => Math.max(max, candidate.sort_order ?? 0),
      0
    );

    for (const batch of chunkArray(newCandidateIds, 300)) {
      const { error } = await supabase.from("set_candidates").insert(
        batch.map((trackId, index) => ({
          user_id: userId,
          project_id: projectId,
          track_id: trackId,
          status: "candidate",
          sort_order: maxSortOrder + index + 1,
        }))
      );

      if (error) {
        return {
          ok: false,
          message: `Tracks salvas, mas falhou ao criar candidatas: ${error.message}`,
        };
      }
    }

    const reused = uniqueRows.length - toCreate.length;
    const alreadyCandidates = importedTrackIds.length - newCandidateIds.length;

    return {
      ok: true,
      message: `${toCreate.length} nova(s), ${reused} reutilizada(s); ${newCandidateIds.length} adicionada(s) como candidata(s) no projeto.${alreadyCandidates ? ` ${alreadyCandidates} já era(m) candidata(s).` : ""}`,
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
