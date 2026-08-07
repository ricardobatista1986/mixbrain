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
  return header.trim().toLowerCase();
}

function guessMapping(headers: string[]): MappingState {
  function findHeader(possibleNames: string[]) {
    const found = headers.find((header) =>
      possibleNames.some(
        (possible) => normalizeHeader(header) === normalizeHeader(possible)
      )
    );

    return found ?? "";
  }

  return {
    title: findHeader(["title", "track", "track_title", "name"]),
    artist: findHeader(["artist", "artists"]),
    bpm: findHeader(["bpm"]),
    musical_key: findHeader(["musical_key", "key", "camelot"]),
    energy: findHeader(["energy"]),
    mood: findHeader(["mood"]),
    notes: findHeader(["notes", "comment", "comments"]),
  };
}

function toNullableString(value: string) {
  const cleaned = value.trim();
  return cleaned ? cleaned : null;
}

function toNullableNumber(value: string) {
  const cleaned = value.trim().replace(",", ".");

  if (!cleaned) return null;

  const parsed = Number(cleaned);

  if (Number.isNaN(parsed)) return null;

  return parsed;
}

function buildParsedRows(
  sourceRows: RawCsvRow[],
  mapping: MappingState
): { validRows: ParsedRow[]; invalidCount: number } {
  let invalidCount = 0;

  const validRows = sourceRows
    .map((row) => {
      const title = mapping.title ? String(row[mapping.title] ?? "").trim() : "";
      const artist = mapping.artist ? String(row[mapping.artist] ?? "").trim() : "";
      const bpm = mapping.bpm ? String(row[mapping.bpm] ?? "").trim() : "";
      const musicalKey = mapping.musical_key
        ? String(row[mapping.musical_key] ?? "").trim()
        : "";
      const energy = mapping.energy ? String(row[mapping.energy] ?? "").trim() : "";
      const mood = mapping.mood ? String(row[mapping.mood] ?? "").trim() : "";
      const notes = mapping.notes ? String(row[mapping.notes] ?? "").trim() : "";

      if (!title) {
        invalidCount += 1;
        return null;
      }

      const parsedEnergy = toNullableNumber(energy);

      if (parsedEnergy !== null && (parsedEnergy < 1 || parsedEnergy > 10)) {
        invalidCount += 1;
        return null;
      }

      return {
        title,
        artist: toNullableString(artist),
        bpm: toNullableNumber(bpm),
        musical_key: toNullableString(musicalKey),
        energy: parsedEnergy,
        mood: toNullableString(mood),
        notes: toNullableString(notes),
      };
    })
    .filter((row): row is ParsedRow => row !== null);

  return { validRows, invalidCount };
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
    const { validRows, invalidCount } = buildParsedRows(rawRows, mapping);
    const { uniqueRows, duplicateCount } = dedupeRows(validRows);

    return {
      validRows,
      invalidCount,
      duplicateCount,
      uniqueRows,
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
      const result = await importTracksFromCsvToProject(
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
          </p>

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
              <p className="mt-2 text-3xl font-black">{processed.validRows.length}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Inválidas
              </p>
              <p className="mt-2 text-3xl font-black">{processed.invalidCount}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Duplicadas no CSV
              </p>
              <p className="mt-2 text-3xl font-black">{processed.duplicateCount}</p>
            </div>
          </div>

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

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black tracking-tight">Exemplo de CSV</h2>
          <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-300">
{`title,artist,bpm,musical_key,energy,mood,notes
Track A,Artist A,124,8A,6,hypnotic,opening tool
Track B,Artist B,126,8B,7,dark peak,main lift
Track C,Artist C,123,7A,5,deep,respiro`}
          </pre>
        </div>
      </section>
    </main>
  );
}
