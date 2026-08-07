"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useEffect, useMemo, useState, useTransition } from "react";
import { importTracksFromCsv, listImportProjects } from "./server-actions";

type RawCsvRow = Record<string, string>;

type ParsedRow = {
  title: string;
  artist: string;
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

type MappingState = {
  title: string;
  artist: string;
  bpm: string;
  musical_key: string;
  energy: string;
  mood: string;
  notes: string;
};

const emptyMapping: MappingState = {
  title: "",
  artist: "",
  bpm: "",
  musical_key: "",
  energy: "",
  mood: "",
  notes: "",
};

const fields: Array<keyof MappingState> = [
  "title",
  "artist",
  "bpm",
  "musical_key",
  "energy",
  "mood",
  "notes",
];

const labels: Record<keyof MappingState, string> = {
  title: "Título",
  artist: "Artista",
  bpm: "BPM",
  musical_key: "Key / Camelot",
  energy: "Energia",
  mood: "Mood",
  notes: "Notas",
};

function clean(value: string) {
  const output = value.trim();
  return output || null;
}

function numberOrNull(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function headerMatch(headers: string[], options: string[]) {
  return (
    headers.find((header) =>
      options.includes(header.trim().toLocaleLowerCase())
    ) ?? ""
  );
}

function detectMapping(headers: string[]): MappingState {
  return {
    title: headerMatch(headers, ["title", "track", "track_title", "name", "titulo", "título"]),
    artist: headerMatch(headers, ["artist", "artists", "artista"]),
    bpm: headerMatch(headers, ["bpm"]),
    musical_key: headerMatch(headers, ["musical_key", "key", "camelot", "chave"]),
    energy: headerMatch(headers, ["energy", "energia"]),
    mood: headerMatch(headers, ["mood"]),
    notes: headerMatch(headers, ["notes", "note", "comment", "comments", "notas"]),
  };
}

function parseRows(rows: RawCsvRow[], mapping: MappingState) {
  let invalidCount = 0;
  const parsed = rows
    .map((row) => {
      const value = (field: keyof MappingState) =>
        mapping[field] ? String(row[mapping[field]] ?? "").trim() : "";
      const title = value("title");
      const artist = value("artist");
      const energy = numberOrNull(value("energy"));

      if (!title || !artist || (energy !== null && (energy < 1 || energy > 10))) {
        invalidCount += 1;
        return null;
      }

      return {
        title,
        artist,
        bpm: numberOrNull(value("bpm")),
        musical_key: clean(value("musical_key")),
        energy,
        mood: clean(value("mood")),
        notes: clean(value("notes")),
      };
    })
    .filter((row): row is ParsedRow => row !== null);

  const seen = new Set<string>();
  let duplicateCount = 0;
  const uniqueRows = parsed.filter((row) => {
    const key = `${row.title.toLocaleLowerCase()}::${row.artist?.toLocaleLowerCase()}`;
    if (seen.has(key)) {
      duplicateCount += 1;
      return false;
    }
    seen.add(key);
    return true;
  });

  return { invalidCount, duplicateCount, uniqueRows };
}

export default function ImportarCsvPage() {
  const [projects, setProjects] = useState<ImportProject[]>([]);
  const [projectId, setProjectId] = useState("");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawCsvRow[]>([]);
  const [mapping, setMapping] = useState<MappingState>(emptyMapping);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void listImportProjects().then((items) => {
      setProjects(items);
      if (items.length === 1) setProjectId(items[0].id);
    });
  }, []);

  const processed = useMemo(
    () => parseRows(rawRows, mapping),
    [rawRows, mapping]
  );

  function resetCsv() {
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping(emptyMapping);
  }

  function handleFile(file: File | null) {
    setError("");
    setMessage("");
    resetCsv();
    if (!file) return;

    setFileName(file.name);
    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        const parsedHeaders = (result.meta.fields ?? []).filter(Boolean);
        if (!parsedHeaders.length || !result.data.length) {
          setError("O CSV deve conter cabeçalhos e pelo menos uma linha de dados.");
          return;
        }
        setHeaders(parsedHeaders);
        setRawRows(result.data);
        setMapping(detectMapping(parsedHeaders));
      },
      error(parseError) {
        setError(`Erro ao ler CSV: ${parseError.message}`);
      },
    });
  }

  function handleImport() {
    setError("");
    setMessage("");

    if (!projectId) {
      setError("Selecione o projeto que receberá as candidatas.");
      return;
    }
    if (!mapping.title || !mapping.artist) {
      setError("Mapeie as colunas de título e artista.");
      return;
    }
    if (!processed.uniqueRows.length) {
      setError("Não há linhas válidas para importar.");
      return;
    }

    startTransition(async () => {
      const result = await importTracksFromCsv(processed.uniqueRows, projectId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      resetCsv();
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_40%)]">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10 lg:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Biblioteca</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Importar tracks por CSV</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Selecione o projeto de destino. Tracks existentes serão reutilizadas; novas tracks serão criadas e todas entrarão automaticamente como candidatas do projeto.
          </p>
          <Link href="/app" className="mt-6 inline-block rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100">
            Voltar ao workspace
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-6 py-10 sm:px-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black">1. Projeto e arquivo</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-300">
              Projeto de destino
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-slate-100">
                <option value="">Selecione um projeto</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-300">
              Arquivo CSV
              <input type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-slate-200" />
            </label>
          </div>
          {!projects.length ? <p className="mt-4 text-sm text-amber-200">Crie um projeto no workspace antes de importar.</p> : null}
          {fileName ? <p className="mt-4 text-sm text-slate-300">Arquivo carregado: {fileName}</p> : null}
          {error ? <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">{error}</p> : null}
          {message ? <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">{message}</p> : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black">2. Mapeamento</h2>
          <p className="mt-2 text-sm text-slate-400">Título e artista são obrigatórios. Energia, quando informada, deve estar entre 1 e 10.</p>
          {headers.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {fields.map((field) => (
                <label key={field} className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {labels[field]}{field === "title" || field === "artist" ? " *" : ""}
                  <select value={mapping[field]} onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))} className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-100">
                    <option value="">Não mapear</option>
                    {headers.map((header) => <option key={`${field}-${header}`} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
          ) : <p className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-400">Envie um CSV para configurar o mapeamento.</p>}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">3. Revisão e importação</h2>
              <p className="mt-2 text-sm text-slate-400">Duplicidades dentro do CSV são removidas por título + artista.</p>
            </div>
            <button type="button" onClick={handleImport} disabled={isPending || !processed.uniqueRows.length} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {isPending ? "Importando..." : `Importar ${processed.uniqueRows.length} track(s)`}
            </button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <Metric label="Linhas CSV" value={rawRows.length} />
            <Metric label="Válidas" value={processed.uniqueRows.length} />
            <Metric label="Inválidas" value={processed.invalidCount} />
            <Metric label="Duplicadas" value={processed.duplicateCount} />
          </div>
          {processed.uniqueRows.length ? (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-[0.14em] text-slate-400"><tr><th className="p-3">Título</th><th className="p-3">Artista</th><th className="p-3">BPM</th><th className="p-3">Key</th><th className="p-3">Energia</th></tr></thead>
                <tbody>{processed.uniqueRows.slice(0, 10).map((row, index) => <tr key={`${row.title}-${row.artist}-${index}`} className="border-t border-white/10 text-slate-200"><td className="p-3">{row.title}</td><td className="p-3">{row.artist}</td><td className="p-3">{row.bpm ?? "—"}</td><td className="p-3">{row.musical_key ?? "—"}</td><td className="p-3">{row.energy ?? "—"}</td></tr>)}</tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4"><p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>;
}
