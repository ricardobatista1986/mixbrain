"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { importTracksFromCsv } from "./server-actions";
import { autoOrganizeTracklist } from "@/app/app/projetos/[id]/actions";

type RawCsvRow = Record<string, string>;

type ParsedRow = {
  title: string;
  artist: string | null;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
  notes: string | null;
};

type MappingState = {
  title: string;
  artist: string;
  bpm: string;
  musical_key: string;
  energy: string;
  mood: string;
  notes: string;
  valence: string;
  danceability: string;
  acousticness: string;
  instrumentalness: string;
  speechiness: string;
};

type ProjectOption = {
  id: string;
  name: string;
};

const REQUIRED_FIELDS: Array<keyof MappingState> = ["title"];

const MAIN_FIELDS: Array<keyof MappingState> = [
  "title",
  "artist",
  "bpm",
  "musical_key",
  "energy",
  "mood",
  "notes",
];

const FEATURE_FIELDS: Array<keyof MappingState> = [
  "valence",
  "danceability",
  "acousticness",
  "instrumentalness",
  "speechiness",
];

const FIELD_LABELS: Record<keyof MappingState, string> = {
  title: "Título",
  artist: "Artista",
  bpm: "BPM",
  musical_key: "Key Camelot",
  energy: "Energia",
  mood: "Mood / Gênero",
  notes: "Notas",
  valence: "Valence (positividade)",
  danceability: "Danceability",
  acousticness: "Acousticness",
  instrumentalness: "Instrumentalness",
  speechiness: "Speechiness",
};

const emptyMapping: MappingState = {
  title: "",
  artist: "",
  bpm: "",
  musical_key: "",
  energy: "",
  mood: "",
  notes: "",
  valence: "",
  danceability: "",
  acousticness: "",
  instrumentalness: "",
  speechiness: "",
};

// Lotes enviados um de cada vez pro server action, para nunca esbarrar em
// limite de tamanho de payload nem deixar o usuário sem feedback num
// arquivo de milhares de linhas.
const IMPORT_BATCH_SIZE = 150;

function normalizeHeader(header: string) {
  // Remove BOM (comum em CSVs exportados do Excel/Chosic) e normaliza espaços.
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function guessMapping(headers: string[]): MappingState {
  function findHeader(possibleNames: string[]) {
    // 1) Correspondência exata (ignorando maiúsculas/minúsculas, espaços e BOM).
    const exact = headers.find((header) =>
      possibleNames.some(
        (possible) => normalizeHeader(header) === normalizeHeader(possible)
      )
    );

    if (exact) return exact;

    // 2) Correspondência parcial: aceita cabeçalhos como "Track Name",
    // "Nome da Faixa (Original)" etc., que contêm um dos apelidos conhecidos.
    const partial = headers.find((header) =>
      possibleNames.some((possible) =>
        normalizeHeader(header).includes(normalizeHeader(possible))
      )
    );

    return partial ?? "";
  }

  // Vocabulário conhecido (Chosic, Spotify/Exportify, Rekordbox, planilhas em PT-BR etc.)
  return {
    title: findHeader([
      "title",
      "track title",
      "track_title",
      "track name",
      "name",
      "song",
      "música",
      "musica",
      "faixa",
      "nome da faixa",
      "titulo",
      "título",
    ]),
    artist: findHeader(["artist", "artists", "artist name", "artista", "artistas"]),
    bpm: findHeader(["bpm", "tempo", "bpm (original)"]),
    musical_key: findHeader([
      "camelot",
      "musical_key",
      "key (camelot)",
      "chave",
      "tom",
      "tonalidade",
      "key",
    ]),
    energy: findHeader([
      "energy",
      "energia",
      "energy level",
      "nível de energia",
      "nivel de energia",
    ]),
    mood: findHeader([
      "mood",
      "genres",
      "genre",
      "parent genres",
      "gênero",
      "genero",
      "estilo",
    ]),
    notes: findHeader(["notes", "comment", "comments", "notas", "observações", "observacoes"]),
    valence: findHeader(["valence"]),
    danceability: findHeader(["danceability", "dance"]),
    acousticness: findHeader(["acousticness", "acoustic"]),
    instrumentalness: findHeader(["instrumentalness", "instrumental"]),
    speechiness: findHeader(["speechiness", "speech"]),
  };
}

function toNullableString(value: string) {
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

// Extrai o primeiro número de textos como "124 BPM", "7/10" ou "8,0".
function extractNumber(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;

  const withDot = cleaned.replace(",", ".");
  const match = withDot.match(/-?\d+(\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

// O MixBrain usa energia numa escala de 1 a 10 (mesma escala do cadastro
// manual e do cálculo de score de transição). Bases exportadas do Spotify/
// Chosic costumam vir em 0-100. Detectamos a escala pelo maior valor
// encontrado na coluna mapeada e convertemos automaticamente.
function detectEnergyScale(rows: RawCsvRow[], energyHeader: string): 10 | 100 {
  if (!energyHeader) return 10;

  let maxValue = 0;
  for (const row of rows) {
    const raw = String(row[energyHeader] ?? "").trim();
    if (!raw) continue;
    const value = extractNumber(raw);
    if (value !== null && value > maxValue) maxValue = value;
  }

  return maxValue > 10 ? 100 : 10;
}

function normalizeEnergy(raw: string, scale: 10 | 100): number | null {
  const value = extractNumber(raw);
  if (value === null || value <= 0) return null;

  const scaled = scale === 100 ? value / 10 : value;
  return Math.min(10, Math.max(1, Math.round(scaled)));
}

// Features de áudio no estilo Spotify (valence, danceability, acousticness,
// instrumentalness, speechiness) costumam vir em escala 0–1, mas alguns
// exports (Chosic) usam 0–100. Mesma lógica de detecção da energia,
// generalizada.
function detect01Scale(rows: RawCsvRow[], header: string): 1 | 100 {
  if (!header) return 1;

  let maxValue = 0;
  for (const row of rows) {
    const raw = String(row[header] ?? "").trim();
    if (!raw) continue;
    const value = extractNumber(raw);
    if (value !== null && value > maxValue) maxValue = value;
  }

  return maxValue > 1.5 ? 100 : 1;
}

function normalize01(raw: string, scale: 1 | 100): number | null {
  const value = extractNumber(raw);
  if (value === null) return null;

  const scaled = scale === 100 ? value / 100 : value;
  return Math.min(1, Math.max(0, scaled));
}

/**
 * Deriva tags de mood a partir de features de áudio (quando disponíveis),
 * usando o modelo clássico valence×energy (quadrantes de humor musical:
 * eufórico, sombrio, melancólico, relaxado) mais sinais adicionais de
 * acousticness/instrumentalness/danceability. É uma heurística baseada em
 * limiares — não é análise de áudio de verdade, é inferência a partir de
 * metadados já presentes no CSV. Serve para preencher automaticamente uma
 * característica que, de outra forma, ficaria vazia ou dependeria 100% de
 * digitação manual.
 */
function deriveMoodTags(features: {
  valence: number | null;
  energy10: number | null;
  danceability: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  speechiness: number | null;
}): string[] {
  const tags: string[] = [];
  const { valence, energy10, danceability, acousticness, instrumentalness, speechiness } =
    features;

  if (valence !== null && energy10 !== null) {
    const highEnergy = energy10 >= 6;
    const lowEnergy = energy10 < 4;
    const highValence = valence >= 0.55;
    const lowValence = valence < 0.4;

    if (highValence && highEnergy) tags.push("Eufórico");
    else if (lowValence && highEnergy) tags.push("Sombrio");
    else if (lowValence && lowEnergy) tags.push("Melancólico");
    else if (highValence && lowEnergy) tags.push("Relaxado");
  }

  if (acousticness !== null && acousticness >= 0.6) tags.push("Acústico");
  if (instrumentalness !== null && instrumentalness >= 0.5) tags.push("Instrumental");
  if (speechiness !== null && speechiness >= 0.33) tags.push("Vocal falado");
  if (danceability !== null && danceability >= 0.7) tags.push("Dançante");

  return tags;
}

function buildParsedRows(
  sourceRows: RawCsvRow[],
  mapping: MappingState
): { validRows: ParsedRow[]; invalidCount: number; energyScale: 10 | 100; hasFeatureColumns: boolean } {
  const energyScale = detectEnergyScale(sourceRows, mapping.energy);

  const valenceScale = detect01Scale(sourceRows, mapping.valence);
  const danceScale = detect01Scale(sourceRows, mapping.danceability);
  const acousticScale = detect01Scale(sourceRows, mapping.acousticness);
  const instrumentalScale = detect01Scale(sourceRows, mapping.instrumentalness);
  const speechScale = detect01Scale(sourceRows, mapping.speechiness);

  const hasFeatureColumns = Boolean(
    mapping.valence ||
      mapping.danceability ||
      mapping.acousticness ||
      mapping.instrumentalness ||
      mapping.speechiness
  );

  let invalidCount = 0;

  const validRows = sourceRows
    .map((row) => {
      const title = mapping.title ? String(row[mapping.title] ?? "").trim() : "";

      // Único critério que invalida a linha: título ausente. Os demais
      // campos, quando não reconhecíveis, apenas ficam vazios — não
      // descartam a track (parser tolerante).
      if (!title) {
        invalidCount += 1;
        return null;
      }

      const artist = mapping.artist ? String(row[mapping.artist] ?? "").trim() : "";
      const bpmRaw = mapping.bpm ? String(row[mapping.bpm] ?? "").trim() : "";
      const musicalKey = mapping.musical_key
        ? String(row[mapping.musical_key] ?? "").trim()
        : "";
      const energyRaw = mapping.energy ? String(row[mapping.energy] ?? "").trim() : "";
      const rawMood = mapping.mood ? String(row[mapping.mood] ?? "").trim() : "";
      const notes = mapping.notes ? String(row[mapping.notes] ?? "").trim() : "";

      const bpmValue = extractNumber(bpmRaw);
      const energyValue = energyRaw ? normalizeEnergy(energyRaw, energyScale) : null;

      let mood = toNullableString(rawMood);

      if (hasFeatureColumns) {
        const valence = mapping.valence
          ? normalize01(String(row[mapping.valence] ?? ""), valenceScale)
          : null;
        const danceability = mapping.danceability
          ? normalize01(String(row[mapping.danceability] ?? ""), danceScale)
          : null;
        const acousticness = mapping.acousticness
          ? normalize01(String(row[mapping.acousticness] ?? ""), acousticScale)
          : null;
        const instrumentalness = mapping.instrumentalness
          ? normalize01(String(row[mapping.instrumentalness] ?? ""), instrumentalScale)
          : null;
        const speechiness = mapping.speechiness
          ? normalize01(String(row[mapping.speechiness] ?? ""), speechScale)
          : null;

        const derivedTags = deriveMoodTags({
          valence,
          energy10: energyValue,
          danceability,
          acousticness,
          instrumentalness,
          speechiness,
        });

        if (derivedTags.length > 0) {
          mood = mood ? `${mood} · ${derivedTags.join(", ")}` : derivedTags.join(", ");
        }
      }

      return {
        title,
        artist: toNullableString(artist),
        bpm: bpmValue !== null && bpmValue > 0 ? bpmValue : null,
        musical_key: toNullableString(musicalKey),
        energy: energyValue,
        mood,
        notes: toNullableString(notes),
      };
    })
    .filter((row): row is ParsedRow => row !== null);

  return { validRows, invalidCount, energyScale, hasFeatureColumns };
}

// Duplicatas dentro do CSV NÃO são mais removidas aqui — só contadas para
// informação. A resolução de identidade de verdade acontece no servidor,
// por título+artista já normalizado contra a track real (reaproveita a
// mesma track em vez de criar duas), e o banco garante que a mesma track
// nunca vira duas candidatas do mesmo projeto. Filtrar cedo demais no
// navegador só arriscava descartar linhas que o usuário queria ver
// processadas.
function countDuplicates(rows: ParsedRow[]) {
  const seen = new Set<string>();
  let duplicates = 0;

  for (const row of rows) {
    const key = `${row.title.trim().toLowerCase()}::${(row.artist ?? "")
      .trim()
      .toLowerCase()}`;

    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export default function ImportarCsvClientPage({
  projects,
}: {
  projects: ProjectOption[];
}) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawCsvRow[]>([]);
  const [mapping, setMapping] = useState<MappingState>(emptyMapping);
  const [projectId, setProjectId] = useState("");
  const [autoOrganizeAfter, setAutoOrganizeAfter] = useState(true);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetState() {
    setHeaders([]);
    setRawRows([]);
    setMapping(emptyMapping);
  }

  function handleFileChange(file: File | null) {
    setError("");
    setResultMessage("");
    resetState();

    if (!file) {
      setFileName("");
      return;
    }

    setFileName(file.name);

    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [",", ";", "\t", "|"],
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      complete(results) {
        const parsedRows = results.data ?? [];
        const metaFields = (results.meta.fields ?? []).filter(Boolean);

        if (!metaFields.length) {
          setError("O CSV não possui cabeçalhos válidos.");
          return;
        }

        if (!parsedRows.length) {
          setError("O CSV não possui linhas de dados.");
          return;
        }

        setHeaders(metaFields);
        setRawRows(parsedRows);
        setMapping(guessMapping(metaFields));
      },
      error(parseError) {
        setError(`Erro ao ler CSV: ${parseError.message}`);
      },
    });
  }

  const processed = useMemo(() => {
    const { validRows, invalidCount, energyScale, hasFeatureColumns } = buildParsedRows(
      rawRows,
      mapping
    );
    const duplicateCount = countDuplicates(validRows);

    return {
      validRows,
      invalidCount,
      duplicateCount,
      energyScale,
      hasFeatureColumns,
      previewRows: validRows.slice(0, 10),
    };
  }, [rawRows, mapping]);

  async function handleImport() {
    setError("");
    setResultMessage("");

    if (!projectId) {
      setError("Selecione o projeto que vai receber as candidatas.");
      return;
    }

    if (!mapping.title) {
      setError("Você precisa mapear a coluna de título.");
      return;
    }

    if (processed.validRows.length === 0) {
      setError("Nenhuma linha válida para importar.");
      return;
    }

    const batches = chunk(processed.validRows, IMPORT_BATCH_SIZE);

    startTransition(async () => {
      setProgress({ done: 0, total: processed.validRows.length });

      let created = 0;
      let reused = 0;
      let candidatesAdded = 0;
      let alreadyCandidate = 0;
      let processedSoFar = 0;

      for (const batch of batches) {
        const result = await importTracksFromCsv(batch, projectId);

        if (!result.ok) {
          setError(result.message);
          setProgress(null);
          return;
        }

        created += result.createdCount;
        reused += result.reusedCount;
        candidatesAdded += result.candidatesAddedCount;
        alreadyCandidate += result.alreadyCandidateCount;
        processedSoFar += batch.length;
        setProgress({ done: processedSoFar, total: processed.validRows.length });
      }

      let message =
        `${created} track(s) nova(s) criada(s), ${reused} reaproveitada(s) da ` +
        `biblioteca, ${candidatesAdded} adicionada(s) como candidata(s) neste ` +
        `projeto (${alreadyCandidate} já estava(m) nele).`;

      if (autoOrganizeAfter && (candidatesAdded > 0 || alreadyCandidate > 0)) {
        try {
          const orgResult = await autoOrganizeTracklist(projectId);
          message += ` Tracklist gerada automaticamente: ${orgResult.totalCount} track(s) no total.`;
        } catch (orgError) {
          message +=
            " Não foi possível gerar a tracklist automaticamente agora " +
            `(${orgError instanceof Error ? orgError.message : "erro desconhecido"}); ` +
            "as candidatas foram importadas normalmente, use o botão " +
            "\"Gerar ordem automática\" na página do projeto.";
        }
      }

      setResultMessage(message);
      setProgress(null);
      setFileName("");
      resetState();
    });
  }

  return (
    <main className="min-h-screen bg-claude-bg text-claude-text">
      <section className="border-b border-claude-border bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_40%)]">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10 lg:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
            Biblioteca e Projetos
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Importar CSV para um projeto
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-claude-text-muted">
            Toda linha válida entra na biblioteca (reaproveitando tracks já
            existentes) e é adicionada como candidata do projeto escolhido —
            inclusive se parecer duplicada. Arquivos grandes (milhares de
            linhas) são enviados em lotes automaticamente.
          </p>

          <div className="mt-6">
            <Link
              href="/app"
              className="rounded-full border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted transition hover:border-claude-accent/50 hover:text-claude-accent-hover"
            >
              Voltar ao workspace
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
        <div className="rounded-3xl border border-claude-border bg-claude-surface p-6">
          <h2 className="text-2xl font-black tracking-tight">1. Projeto de destino</h2>
          <p className="mt-2 text-sm text-claude-text-muted">
            Escolha qual projeto vai receber as tracks como candidatas.
          </p>

          <div className="mt-6 max-w-xl">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-claude-border bg-claude-surface px-3 py-3 text-sm text-claude-text outline-none"
            >
              <option value="">Selecione um projeto...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <label className="mt-4 flex items-start gap-3 text-sm text-claude-text-muted">
            <input
              type="checkbox"
              checked={autoOrganizeAfter}
              onChange={(e) => setAutoOrganizeAfter(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-claude-border bg-claude-surface"
            />
            <span>
              Gerar a ordem da tracklist automaticamente ao final da
              importação (aprova as candidatas e organiza por compatibilidade
              — mesma ação do botão &quot;Gerar ordem automática&quot; na
              página do projeto). Você pode ajustar manualmente depois.
            </span>
          </label>
        </div>

        <div className="mt-8 rounded-3xl border border-claude-border bg-claude-surface p-6">
          <h2 className="text-2xl font-black tracking-tight">2. Upload</h2>
          <p className="mt-2 text-sm text-claude-text-muted">
            Envie um CSV com cabeçalho. O sistema tentará reconhecer as colunas automaticamente.
          </p>

          <div className="mt-6">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-claude-border bg-claude-surface p-3 text-sm text-claude-text"
            />
          </div>

          {fileName ? (
            <p className="mt-3 text-sm text-claude-text-muted">Arquivo carregado: {fileName}</p>
          ) : null}

          {progress ? (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-claude-surface-3">
                <div
                  className="h-full bg-claude-accent transition-all"
                  style={{
                    width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-claude-text-muted">
                Importando {progress.done} de {progress.total} linha(s)...
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {resultMessage ? (
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              {resultMessage}{" "}
              {projectId ? (
                <Link href={`/app/projetos/${projectId}`} className="font-bold underline">
                  Abrir o projeto →
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-8 rounded-3xl border border-claude-border bg-claude-surface p-6">
          <h2 className="text-2xl font-black tracking-tight">3. Mapeamento de colunas</h2>
          <p className="mt-2 text-sm text-claude-text-muted">
            Confirme quais colunas do CSV correspondem aos campos do MixBrain.
            Apenas o Título é obrigatório. BPM, energia e demais campos numéricos
            que não puderem ser lidos ficam em branco, mas não descartam a track.
            Energia em escala 0–100 é detectada e convertida automaticamente
            para a escala 1–10 usada no MixBrain. Mood é só um critério
            <strong> a mais</strong> no score de compatibilidade — quando
            presente, ajuda a comparar tracks; quando ausente, o sistema
            simplesmente ignora esse fator e usa os outros (harmonia, energia,
            BPM), sem penalizar a track por não ter mood definido.
          </p>

          {headers.length > 0 ? (
            <p className="mt-3 text-xs text-claude-text0">
              Cabeçalhos detectados no arquivo: {headers.join(", ")}
            </p>
          ) : null}

          {headers.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-claude-border p-6 text-center text-claude-text-muted">
              Envie um CSV para começar o mapeamento.
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {MAIN_FIELDS.map((field) => (
                  <div
                    key={field}
                    className="rounded-2xl border border-claude-border bg-claude-surface/50 p-4"
                  >
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-claude-text-muted">
                      {FIELD_LABELS[field]}
                      {REQUIRED_FIELDS.includes(field) ? " *" : ""}
                    </label>

                    <select
                      value={mapping[field]}
                      onChange={(e) =>
                        setMapping((current) => ({ ...current, [field]: e.target.value }))
                      }
                      className="w-full rounded-xl border border-claude-border bg-claude-bg px-3 py-2 text-sm text-claude-text outline-none"
                    >
                      <option value="">Não mapear</option>
                      {headers.map((header) => (
                        <option key={`${field}-${header}`} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <details className="mt-6 rounded-2xl border border-claude-border bg-claude-surface/30 p-4">
                <summary className="cursor-pointer text-sm font-bold text-claude-accent-hover">
                  Avançado — features de áudio (opcional, usadas para
                  enriquecer o mood automaticamente)
                </summary>
                <p className="mt-3 text-xs leading-5 text-claude-text-muted">
                  Se o CSV tiver colunas como Valence, Danceability,
                  Acousticness, Instrumentalness ou Speechiness (padrão
                  Spotify/Chosic), o MixBrain deriva tags de mood
                  automaticamente (ex.: &quot;Eufórico&quot;,
                  &quot;Melancólico&quot;, &quot;Acústico&quot;) combinando
                  essas colunas com a energia — mesmo que o CSV não tenha uma
                  coluna de mood/gênero própria.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {FEATURE_FIELDS.map((field) => (
                    <div
                      key={field}
                      className="rounded-2xl border border-claude-border bg-claude-surface/50 p-4"
                    >
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-claude-text-muted">
                        {FIELD_LABELS[field]}
                      </label>
                      <select
                        value={mapping[field]}
                        onChange={(e) =>
                          setMapping((current) => ({ ...current, [field]: e.target.value }))
                        }
                        className="w-full rounded-xl border border-claude-border bg-claude-bg px-3 py-2 text-sm text-claude-text outline-none"
                      >
                        <option value="">Não mapear</option>
                        {headers.map((header) => (
                          <option key={`${field}-${header}`} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>

        <div className="mt-8 rounded-3xl border border-claude-border bg-claude-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight">4. Preview e importação</h2>
              <p className="mt-2 text-sm text-claude-text-muted">
                Veja o que será processado antes de enviar para a biblioteca e para o projeto.
              </p>
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={processed.validRows.length === 0 || isPending}
              className="rounded-xl bg-claude-accent px-5 py-3 text-sm font-bold text-claude-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending
                ? "Importando..."
                : `Importar ${processed.validRows.length} track(s)`}
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-claude-border bg-claude-surface/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-claude-text-muted">Linhas CSV</p>
              <p className="mt-2 text-3xl font-black">{rawRows.length}</p>
            </div>

            <div className="rounded-2xl border border-claude-border bg-claude-surface/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-claude-text-muted">
                Linhas válidas
              </p>
              <p className="mt-2 text-3xl font-black text-emerald-400">
                {processed.validRows.length}
              </p>
            </div>

            <div className="rounded-2xl border border-claude-border bg-claude-surface/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-claude-text-muted">Inválidas</p>
              <p className="mt-2 text-3xl font-black text-rose-400">{processed.invalidCount}</p>
            </div>

            <div className="rounded-2xl border border-claude-border bg-claude-surface/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-claude-text-muted">
                Repetidas no CSV
              </p>
              <p className="mt-2 text-3xl font-black">{processed.duplicateCount}</p>
              <p className="mt-1 text-[11px] leading-4 text-claude-text0">
                Só informativo — todas serão enviadas mesmo assim.
              </p>
            </div>
          </div>

          {processed.energyScale === 100 && mapping.energy ? (
            <div className="mt-4 rounded-xl border border-claude-accent/20 bg-claude-accent/10 p-3 text-xs text-claude-accent-hover">
              Energia detectada em escala 0–100 na coluna &quot;{mapping.energy}&quot;.
              Os valores foram convertidos automaticamente para a escala 1–10
              usada pelo MixBrain.
            </div>
          ) : null}

          {processed.hasFeatureColumns ? (
            <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-400/10 p-3 text-xs text-violet-100">
              Mood sendo enriquecido automaticamente a partir das features de
              áudio mapeadas na seção &quot;Avançado&quot;. Veja a coluna Mood
              no preview abaixo.
            </div>
          ) : null}

          {processed.invalidCount > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
              {processed.invalidCount} linha(s) sem título ficaram de fora
              (título é o único campo obrigatório). Confira o mapeamento da
              coluna Título acima se o número parecer maior que o esperado.
            </div>
          ) : null}

          {processed.validRows.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-claude-border p-6 text-center text-claude-text-muted">
              Nenhuma linha pronta para importação.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-claude-border">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-claude-surface-2/80 text-claude-text-muted">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Artist</th>
                    <th className="px-4 py-3">BPM</th>
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">Energy</th>
                    <th className="px-4 py-3">Mood</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.previewRows.map((row, index) => (
                    <tr
                      key={`${row.title}-${row.artist ?? "sem-artista"}-${index}`}
                      className="border-t border-claude-border"
                    >
                      <td className="px-4 py-3">{row.title}</td>
                      <td className="px-4 py-3">{row.artist ?? "—"}</td>
                      <td className="px-4 py-3">{row.bpm ?? "—"}</td>
                      <td className="px-4 py-3">{row.musical_key ?? "—"}</td>
                      <td className="px-4 py-3">{row.energy ?? "—"}</td>
                      <td className="px-4 py-3">{row.mood ?? "—"}</td>
                      <td className="px-4 py-3">{row.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {processed.validRows.length > 10 ? (
            <p className="mt-3 text-xs text-claude-text-muted">
              Mostrando 10 de {processed.validRows.length} linhas prontas para importação.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
