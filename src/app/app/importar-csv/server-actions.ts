"use server";

import { revalidatePath } from "next/cache";
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

type ImportChunkResult = {
  ok: true;
  createdCount: number;
  reusedCount: number;
  candidatesAddedCount: number;
  alreadyCandidateCount: number;
};

type ImportChunkError = {
  ok: false;
  message: string;
};

const UNKNOWN_ARTIST = "Artista não informado";
const DB_CHUNK_SIZE = 200;
const CANDIDATE_SUB_CHUNK_SIZE = 40;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

// Normalização SÓ para fins de comparação de identidade (nunca altera o
// título/artista exibido ou gravado): remove ruído puro de formatação —
// aspas curvas viradas em retas, acentuação, hífens/travessões variantes,
// espaços duplicados, maiúsculas — para que "Café del Mar" e "Cafe Del Mar"
// (mesma track, digitada diferente) sejam reconhecidas como a mesma. Isso
// NÃO remove sufixos como "(Extended Mix)" ou "(Radio Edit)": remixes e
// edits são tracks distintas de verdade e devem continuar separados. É
// puramente sobre ruído de digitação/exportação, não sobre semântica.
function normalizeForMatching(value: string) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos (café -> cafe)
    .replace(/[\u2018\u2019\u02bc]/g, "'") // aspas simples curvas -> reta
    .replace(/[\u201c\u201d]/g, '"') // aspas duplas curvas -> reta
    .replace(/[\u2013\u2014]/g, "-") // en/em dash -> hífen normal
    .toLocaleLowerCase("pt-BR");
}

function makeTrackKey(title: string, artist: string) {
  return `${normalizeForMatching(title)}::${normalizeForMatching(artist)}`;
}

// Defesa em profundidade: o cliente já normaliza BPM/energia, mas
// nunca confiamos apenas na validação client-side. tracks.energy tem
// CHECK (energy BETWEEN 1 AND 10) e tracks.bpm tem CHECK (bpm > 0) no
// banco — um valor fora do padrão em UMA linha derruba o lote inteiro
// no insert, então normalizamos/descartamos aqui antes de gravar.
function sanitizeEnergy(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 10) return null;
  return rounded;
}

function sanitizeBpm(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

/**
 * Importa um lote de linhas de CSV para a biblioteca e como candidatas de um
 * projeto. Pensado para ser chamado em lotes pelo cliente (algumas centenas
 * de linhas por vez) — arquivos com milhares de linhas devem ser divididos
 * antes de chegar aqui, tanto por causa do limite de tamanho de payload de
 * Server Actions quanto para dar feedback de progresso ao usuário.
 *
 * Dentro de um mesmo lote, tracks e candidatas são gravadas em sub-lotes
 * intercalados (grava tracks do sub-lote → já grava as candidatas
 * correspondentes → só então segue pro próximo sub-lote). Isso limita a
 * "janela de órfãos": se um sub-lote de candidatas falhar, os sub-lotes
 * anteriores já têm tracks E candidatas gravadas juntas, em vez de deixar
 * potencialmente milhares de tracks na biblioteca sem nunca terem virado
 * candidatas do projeto.
 */
export async function importTracksFromCsv(
  rows: ImportRow[],
  projectId: string
): Promise<ImportChunkResult | ImportChunkError> {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) {
    return { ok: false, message: "Sua sessão expirou. Entre novamente." };
  }

  if (!projectId) {
    return { ok: false, message: "Selecione o projeto de destino." };
  }

  if (rows.length === 0) {
    return { ok: false, message: "Não há tracks válidas para importar." };
  }

  const { data: project, error: projectError } = await supabase
    .from("set_projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projectError || !project) {
    return { ok: false, message: "Projeto não encontrado ou sem permissão." };
  }

  // Colapsa duplicatas dentro do próprio lote (mesmo título+artista) — não
  // descarta nada do arquivo original, só evita tentar inserir a mesma track
  // duas vezes na mesma chamada. Duplicatas legítimas entre linhas diferentes
  // do CSV inteiro continuam todas chegando aqui; é aqui, na resolução de
  // identidade da track, que elas se encontram — não antes, no navegador.
  const uniqueRows = new Map<string, ImportRow>();

  for (const row of rows) {
    const title = normalizeText(row.title);
    if (!title) continue;

    const artist = normalizeText(row.artist || UNKNOWN_ARTIST) || UNKNOWN_ARTIST;
    uniqueRows.set(makeTrackKey(title, artist), { ...row, title, artist });
  }

  const cleanRows = [...uniqueRows.values()];

  if (cleanRows.length === 0) {
    return { ok: false, message: "Não há tracks válidas para importar." };
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

  const { data: existingCandidates, error: candidatesQueryError } = await supabase
    .from("set_candidates")
    .select("track_id, sort_order")
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (candidatesQueryError) {
    return {
      ok: false,
      message: `Não foi possível consultar as candidatas: ${candidatesQueryError.message}`,
    };
  }

  const existingCandidateTrackIds = new Set(
    (existingCandidates ?? []).map((candidate) => candidate.track_id)
  );

  let nextSortOrder =
    Math.max(
      0,
      ...(existingCandidates ?? []).map((candidate) => candidate.sort_order ?? 0)
    ) + 1;

  let createdCount = 0;
  let reusedCount = 0;
  let candidatesAddedCount = 0;
  let alreadyCandidateCount = 0;

  for (const batch of chunkArray(cleanRows, DB_CHUNK_SIZE)) {
    const rowsToInsert = batch.filter(
      (row) => !library.has(makeTrackKey(row.title, row.artist || UNKNOWN_ARTIST))
    );

    if (rowsToInsert.length > 0) {
      const trackErrors: string[] = [];

      for (const trackSubChunk of chunkArray(rowsToInsert, CANDIDATE_SUB_CHUNK_SIZE)) {
        // bulk_find_or_create_tracks resolve a identidade da track DENTRO do
        // banco via ON CONFLICT, usando a mesma expressão do índice único
        // tracks_user_normalized_identity_unique — em vez de um INSERT cru
        // que dependia do pré-check em JS (makeTrackKey) bater 1:1 com a
        // normalização em SQL do índice. Os dois motores de normalização
        // (JS Unicode vs regex do Postgres) podem divergir em casos de
        // borda; isso já causou "duplicate key value violates unique
        // constraint" em produção com uma track que o JS achou nova mas o
        // banco já tinha. Com ON CONFLICT, o banco decide por si mesmo —
        // nunca mais diverge da sua própria constraint.
        const { data: resolved, error: rpcError } = await supabase.rpc(
          "bulk_find_or_create_tracks",
          {
            p_rows: trackSubChunk.map((row) => ({
              title: row.title,
              artist: row.artist || UNKNOWN_ARTIST,
              bpm: sanitizeBpm(row.bpm),
              musical_key: row.musical_key,
              energy: sanitizeEnergy(row.energy),
              mood: row.mood,
              notes: row.notes,
            })),
          }
        );

        if (rpcError) {
          trackErrors.push(rpcError.message);
          continue;
        }

        for (const result of (resolved ?? []) as {
          row_index: number;
          id: string;
          was_created: boolean;
        }[]) {
          const row = trackSubChunk[result.row_index];
          if (!row || !result.id) continue;

          library.set(makeTrackKey(row.title, row.artist || UNKNOWN_ARTIST), {
            id: result.id,
            title: row.title,
            artist: row.artist || UNKNOWN_ARTIST,
          });

          if (result.was_created) {
            createdCount += 1;
          } else {
            reusedCount += 1;
          }
        }
      }

      if (trackErrors.length > 0) {
        return {
          ok: false,
          message:
            `${createdCount} track(s) e ${candidatesAddedCount} candidata(s) ` +
            `foram gravadas com sucesso antes de um problema. ` +
            `${trackErrors.length} sub-lote(s) de tracks falharam: ` +
            `${trackErrors[0]}. Reenvie o CSV — tracks já criadas são ` +
            `reaproveitadas, não duplicadas.`,
        };
      }
    }

    reusedCount += batch.length - rowsToInsert.length;

    const batchTrackIds = batch
      .map((row) => library.get(makeTrackKey(row.title, row.artist || UNKNOWN_ARTIST))?.id)
      .filter((id): id is string => Boolean(id));

    const candidateRows = batchTrackIds
      .filter((trackId) => !existingCandidateTrackIds.has(trackId))
      .map((trackId) => {
        existingCandidateTrackIds.add(trackId);
        return {
          project_id: projectId,
          track_id: trackId,
          user_id: userId,
          status: "candidate",
          sort_order: nextSortOrder++,
          notes: null,
        };
      });

    alreadyCandidateCount += batchTrackIds.length - candidateRows.length;

    // Candidatas são inseridas em sub-lotes pequenos (40) e, se um sub-lote
    // falhar, continuamos tentando os próximos em vez de abortar tudo — uma
    // falha pontual (ex.: conflito transitório) não deve custar centenas de
    // tracks que já teriam entrado como candidatas com sucesso. Erros são
    // acumulados e reportados no final, não escondidos.
    const candidateErrors: string[] = [];

    for (const candidateSubChunk of chunkArray(candidateRows, CANDIDATE_SUB_CHUNK_SIZE)) {
      const { error: candidatesInsertError } = await supabase
        .from("set_candidates")
        .insert(candidateSubChunk);

      if (candidatesInsertError) {
        candidateErrors.push(candidatesInsertError.message);
        // Essas track_ids não viraram candidatas de fato — tira do "já
        // marcado como candidato" pra não mascarar a falha no relatório.
        for (const row of candidateSubChunk) {
          existingCandidateTrackIds.delete(row.track_id);
        }
        continue;
      }

      candidatesAddedCount += candidateSubChunk.length;
    }

    if (candidateErrors.length > 0) {
      return {
        ok: false,
        message:
          `${createdCount} track(s) gravadas e ${candidatesAddedCount} ` +
          `candidata(s) adicionadas com sucesso antes de um problema. ` +
          `${candidateErrors.length} sub-lote(s) de candidatas falharam: ` +
          `${candidateErrors[0]}. Reenvie o CSV para tentar novamente — ` +
          `tracks já existentes são reaproveitadas, não duplicadas, e ` +
          `candidatas já adicionadas não são repetidas.`,
      };
    }
  }

  revalidatePath(`/app/projetos/${projectId}`);
  revalidatePath("/app/tracks");

  return {
    ok: true,
    createdCount,
    reusedCount,
    candidatesAddedCount,
    alreadyCandidateCount,
  };
}

export async function listImportProjects() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;

  if (!userId) {
    return [];
  }

  const { data: projects, error } = await supabase
    .from("set_projects")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return projects ?? [];
}
