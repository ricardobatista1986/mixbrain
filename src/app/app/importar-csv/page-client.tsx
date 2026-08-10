"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { importTracksFromCsv } from "./server-actions";

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
};

type ProjectOption = {
  id: string;
  name: string;
};

const TARGET_FIELDS: Array<keyof MappingState> = [
  "title",
  "artist",
  "bpm",
  "musical_key",
  "energy",
  "mood",
  "notes",
];

const FIELD_LABELS: Record<keyof MappingState, string> = {
  title: "Título",
  artist: "Artista",
  bpm: "BPM",
  musical_key: "Key Camelot",
  energy: "Energia",
  mood: "Mood",
  notes: "Notas",
};

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
    artist: findHeader([
      "artist",
      "artists",
      "artist name",
      "artista",
      "artistas",
    ]),
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
    notes: findHeader([
      "notes",
      "comment",
      "comments",
      "notas",
      "observações",
      "observacoes",
    ]),
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
    if (value !== null && value > maxValue) {
      maxValue = value;
    }
  }

  return maxValue > 10 ? 100 : 10;
}

function normalizeEnergy(raw: string, scale: 10 | 100): number | null {
  const value = extractNumber(raw);

  if (value === null || value <= 0) return null;

  const scaled = scale === 100 ? value / 10 : value;
  const rounded = Math.round(scaled);

  return Math.min(10, Math.max(1, rounded));
}

function buildParsedRows(
  sourceRows: RawCsvRow[],
  mapping: MappingState
): { validRows: ParsedRow[]; invalidCount: number; energyScale: 10 | 100 } {
  const energyScale = detectEnergyScale(sourceRows, mapping.energy);
  let invalidCount = 0;

  const validRows = sourceRows
    .map((row) => {
      const title = mapping.title ? String(row[mapping.title] ?? "").trim() : "";

      // Único critério que invalida a linha: título ausente. Os demais
      // campos, quando não reconhecíveis, apenas ficam vazios — não
      // descartam a track (parser tolerante, conforme diário do projeto).
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
      const mood = mapping.mood ? String(row[mapping.mood] ?? "").trim() : "";
      const notes = mapping.notes ? String(row[mapping.notes] ?? "").trim() : "";

      const bpmValue = extractNumber(bpmRaw);

      return {
        title,
        artist: toNullableString(artist),
        bpm: bpmValue !== null && bpmValue > 0 ? bpmValue : null,
        musical_key: toNullableString(musicalKey),
        energy: energyRaw ? normalizeEnergy(energyRaw, energyScale) : null,
        mood: toNullableString(mood),
        notes: toNullableString(notes),
      };
    })
    .filter((row): row is ParsedRow => row !== null);

  return { validRows, invalidCount, energyScale };
}

function dedupeRows(rows: ParsedRow[]) {
  const seen = new Set<string>();
  const unique: ParsedRow[] = [];
  let duplicates = 0;

  for (const row of rows) {
    const key = `${row.title.trim().toLowerCase()}::${(row.artist ?? "")
      .trim()
      .toLowerCase()}`;

    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }

    seen.add(key);
    unique.push(row);
  }

  return {
    uniqueRows: unique,
    duplicateCount: duplicates,
  };
}

export default function ImportarCsvClientPage({
  projects,
}: {
  projects: ProjectOption[];
}) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawCsvRow[]>([]);
  const [mapping, setMapping] = useState<MappingState>({
    title: "",
    artist: "",
    bpm: "",
    musical_key: "",
    energy: "",
    mood: "",
    notes: "",
  });
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function resetState() {
    setHeaders([]);
    setRawRows([]);
    setMapping({
      title: "",
      artist: "",
      bpm: "",
      musical_key: "",
      energy: "",
      mood: "",
      notes: "",
    });
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
    const { validRows, invalidCount, energyScale } = buildParsedRows(rawRows, mapping);
    const { uniqueRows, duplicateCount } = dedupeRows(validRows);

    return {
      validRows,
      invalidCount,
      duplicateCount,
      uniqueRows,
      energyScale,
      previewRows: uniqueRows.slice(0, 10),
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

    if (processed.uniqueRows.length === 0) {
      setError("Nenhuma linha válida restou para importar.");
      return;
    }

    startTransition(async () => {
      const result = await importTracksFromCsv(
        processed.uniqueRows,
        projectId
      );

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setResultMessage(result.message);
      setFileName("");
      resetState();
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_40%)]">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10 lg:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Biblioteca e Projetos
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Importar CSV para um projeto
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            O CSV cria tracks novas quando necessário, reaproveita as já
            existentes e adiciona tudo como candidatas do projeto escolhido.
          </p>

          <div className="mt-6">
            <Link
              href="/app"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
            >
              Voltar ao workspace
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black tracking-tight">1. Projeto de destino</h2>
          <p className="mt-2 text-sm text-slate-400">
            Escolha qual projeto vai receber as tracks como candidatas.
          </p>

          <div className="mt-6 max-w-xl">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-slate-100 outline-none"
            >
              <option value="">Selecione um projeto...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black tracking-tight">2. Upload</h2>
          <p className="mt-2 text-sm text-slate-400">
            Envie um CSV com cabeçalho. O sistema tentará reconhecer as colunas automaticamente.
          </p>

          <div className="mt-6">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-slate-200"
            />
          </div>

          {fileName ? (
            <p className="mt-3 text-sm text-slate-300">
              Arquivo carregado: {fileName}
            </p>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {resultMessage ? (
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              {resultMessage}
            </div>
          ) : null}
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black tracking-tight">3. Mapeamento de colunas</h2>
          <p className="mt-2 text-sm text-slate-400">
            Confirme quais colunas do CSV correspondem aos campos do MixBrain.
            Apenas o Título é obrigatório. BPM, energia e demais campos numéricos
            que não puderem ser lidos ficam em branco, mas não descartam a track.
            Energia em escala 0–100 é detectada e convertida automaticamente
            para a escala 1–10 usada no MixBrain.
          </p>

          {headers.length > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Cabeçalhos detectados no arquivo: {headers.join(", ")}
            </p>
          ) : null}

          {headers.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-400">
              Envie um CSV para começar o mapeamento.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {TARGET_FIELDS.map((field) => (
                <div
                  key={field}
                  className="rounded-2xl border border-white/10 bg-slate-900/50 p-4"
                >
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {FIELD_LABELS[field]}
                    {field === "title" ? " *" : ""}
                  </label>

                  <select
                    value={mapping[field]}
                    onChange={(e) =>
                      setMapping((current) => ({
                        ...current,
                        [field]: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
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
          )}
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight">
                4. Preview e validação
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Veja o que será processado antes de enviar para a biblioteca e para o projeto.
              </p>
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={processed.uniqueRows.length === 0 || isPending}
              className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending
                ? "Importando..."
                : `Importar ${processed.uniqueRows.length} track(s)`}
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Linhas CSV
              </p>
              <p className="mt-2 text-3xl font-black">{rawRows.length}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Linhas válidas
              </p>
              <p className="mt-2 text-3xl font-black text-emerald-400">{processed.validRows.length}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Inválidas
              </p>
              <p className="mt-2 text-3xl font-black text-rose-400">{processed.invalidCount}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Duplicadas no CSV
              </p>
              <p className="mt-2 text-3xl font-black">{processed.duplicateCount}</p>
            </div>
          </div>

          {processed.energyScale === 100 && mapping.energy ? (
            <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs text-cyan-100">
              Energia detectada em escala 0–100 na coluna &quot;{mapping.energy}&quot;.
              Os valores foram convertidos automaticamente para a escala 1–10
              usada pelo MixBrain.
            </div>
          ) : null}

          {processed.invalidCount > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
              {processed.invalidCount} linha(s) sem título ficaram de fora
              (título é o único campo obrigatório). Confira o mapeamento da
              coluna Título acima se o número parecer maior que o esperado.
            </div>
          ) : null}

          {processed.uniqueRows.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-400">
              Nenhuma linha pronta para importação.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900/80 text-slate-300">
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
                      className="border-t border-white/10"
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

          {processed.uniqueRows.length > 10 ? (
            <p className="mt-3 text-xs text-slate-400">
              Mostrando 10 de {processed.uniqueRows.length} linhas prontas para importação.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
