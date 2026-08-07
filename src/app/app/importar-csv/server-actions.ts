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

type LibraryTrack = {
  id: string;
  title: string;
  artist: string;
};

const UNKNOWN_ARTIST = "Artista não informado";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function makeTrackKey(title: string, artist: string) {
  return `${normalizeText(title).toLocaleLowerCase(
    "pt-BR"
  )}::${normalizeText(artist).toLocaleLowerCase("pt-BR")}`;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function importTracksFromCsv(
  rows: ImportRow[],
  projectId: string
) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) {
    return {
      ok: false,
      message: "Sua sessão expirou. Entre novamente.",
    };
  }

  if (!projectId) {
    return {
      ok: false,
      message: "Selecione o projeto de destino.",
    };
  }

  if (rows.length === 0) {
    return {
      ok: false,
      message: "Não há tracks válidas para importar.",
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
      message: "Projeto não encontrado ou sem permissão.",
    };
  }

  const uniqueRows = new Map<string, ImportRow>();

  for (const row of rows) {
    const title = normalizeText(row.title);

    if (!title) {
      continue;
    }

    const artist =
      normalizeText(row.artist || UNKNOWN_ARTIST) || UNKNOWN_ARTIST;

    uniqueRows.set(makeTrackKey(title, artist), {
      ...row,
      title,
      artist,
    });
  }

  const cleanRows = [...uniqueRows.values()];

  if (cleanRows.length === 0) {
    return {
      ok: false,
      message: "Não há tracks válidas para importar.",
    };
  }

  const { data: libraryRows, error: libraryError } = await supabase
    .from("tracks")
    .select("id, title, artist")
    .eq("user_id", userId);

  if (libraryError) {
    return {
      ok: false,
      message: `Não foi possível consultar a biblioteca: ${libraryError.message}`,
    };
  }

  const library = new Map<string, LibraryTrack>();

  for (const track of (libraryRows ?? []) as LibraryTrack[]) {
    library.set(makeTrackKey(track.title, track.artist), track);
  }

  const rowsToInsert = cleanRows.filter((row) => {
    const artist = row.artist || UNKNOWN_ARTIST;
    return !library.has(makeTrackKey(row.title, artist));
  });

  const insertedTracks: LibraryTrack[] = [];

  for (const batch of chunkArray(rowsToInsert, 250)) {
    const { data, error } = await supabase
      .from("tracks")
      .insert(
        batch.map((row) => ({
          user_id: userId,
          title: row.title,
          artist: row.artist || UNKNOWN_ARTIST,
          bpm: row.bpm,
          musical_key: row.musical_key,
          energy: row.energy,
          mood: row.mood,
          notes: row.notes,
          source_name: "csv",
          source: "csv",
        }))
      )
      .select("id, title, artist");

    if (error) {
      return {
        ok: false,
        message: `Não foi possível gravar a biblioteca: ${error.message}`,
      };
    }

    insertedTracks.push(...((data ?? []) as LibraryTrack[]));
  }

  for (const track of insertedTracks) {
    library.set(makeTrackKey(track.title, track.artist), track);
  }

  const importedTrackIds = cleanRows
    .map((row) => {
      const artist = row.artist || UNKNOWN_ARTIST;
      return library.get(makeTrackKey(row.title, artist))?.id;
    })
    .filter((id): id is string => Boolean(id));

  const { data: existingCandidates, error: candidatesError } = await supabase
    .from("set_candidates")
    .select("track_id, sort_order")
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (candidatesError) {
    return {
      ok: false,
      message: `Não foi possível consultar as candidatas: ${candidatesError.message}`,
    };
  }

  const existingCandidateTrackIds = new Set(
    (existingCandidates ?? []).map((candidate) => candidate.track_id)
  );

  let nextSortOrder =
    Math.max(
      0,
      ...(existingCandidates ?? []).map(
        (candidate) => candidate.sort_order ?? 0
      )
    ) + 1;

  const candidateRows = importedTrackIds
    .filter((trackId) => !existingCandidateTrackIds.has(trackId))
    .map((trackId) => ({
      project_id: projectId,
      track_id: trackId,
      user_id: userId,
      status: "candidate",
      sort_order: nextSortOrder++,
      notes: null,
    }));

  for (const batch of chunkArray(candidateRows, 250)) {
    const { error } = await supabase.from("set_candidates").insert(batch);

    if (error) {
      return {
        ok: false,
        message: `As tracks foram gravadas, mas não puderam entrar como candidatas: ${error.message}`,
      };
    }
  }

  const reusedCount = cleanRows.length - rowsToInsert.length;
  const alreadyCandidateCount = importedTrackIds.length - candidateRows.length;

  return {
    ok: true,
    message:
      `${rowsToInsert.length} track(s) nova(s) criada(s), ` +
      `${reusedCount} reaproveitada(s) da biblioteca e ` +
      `${candidateRows.length} adicionada(s) como candidata(s). ` +
      `${alreadyCandidateCount} já estava(m) neste projeto.`,
  };
}
