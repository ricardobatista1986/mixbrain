"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { importTracksFromCsv } from "./server-actions";

type ParsedRow = {
  title: string;
  artist: string | null;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
  notes: string | null;
};

type RawCsvRow = Record<string, string>;

function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

function getValue(row: RawCsvRow, possibleKeys: string[]) {
  for (const key of possibleKeys) {
    const foundKey = Object.keys(row).find(
      (rowKey) => normalizeHeader(rowKey) === normalizeHeader(key)
    );

    if (foundKey) {
      return String(row[foundKey] ?? "").trim();
    }
  }

  return "";
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

function transformRow(row: RawCsvRow): ParsedRow | null {
  const title = getValue(row, ["title", "track", "track_title", "name"]);
  const artist = getValue(row, ["artist", "artists"]);
  const bpm = getValue(row, ["bpm"]);
  const musicalKey = getValue(row, ["musical_key", "key", "camelot"]);
  const energy = getValue(row, ["energy"]);
  const mood = getValue(row, ["mood"]);
  const notes = getValue(row, ["notes", "comment", "comments"]);

  if (!title) {
    return null;
  }

  return {
    title,
    artist: toNullableString(artist),
    bpm: toNullableNumber(bpm),
    musical_key: toNullableString(musicalKey),
    energy: toNullableNumber(energy),
    mood: toNullableString(mood),
    notes: toNullableString(notes),
  };
}

export default function ImportarCsvPage() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [resultMessage, setResultMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const previewRows = useMemo(() => rows.slice(0, 8), [rows]);

  function handleFileChange(file: File | null) {
    setError("");
    setResultMessage("");
    setRows([]);

    if (!file) return;

    setFileName(file.name);

    Papa.parse<RawCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const parsed = (results.data || [])
          .map(transformRow)
          .filter((row): row is ParsedRow => row !== null);

        if (parsed.length === 0) {
          setError("Nenhuma track válida foi encontrada no CSV.");
          return;
        }

        setRows(parsed);
      },
      error(parseError) {
        setError(`Erro ao ler CSV: ${parseError.message}`);
      },
    });
  }

  async function handleImport() {
    setError("");
    setResultMessage("");

    if (rows.length === 0) {
      setError("Nenhuma linha pronta para importação.");
      return;
    }

    startTransition(async () => {
      const result = await importTracksFromCsv(rows);

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setResultMessage(result.message);
      setRows([]);
      setFileName("");
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_40%)]">
        <div className="mx-auto max-w-5xl px-6 py-14 sm:px-10 lg:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Biblioteca
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Importar tracks por CSV
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Faça upload do seu catálogo e importe várias tracks com BPM, key,
            energia e mood de uma vez.
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

      <section className="mx-auto max-w-5xl px-6 py-10 sm:px-10 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black tracking-tight">
            Upload do arquivo
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Colunas aceitas: title, artist, bpm, musical_key, energy, mood,
            notes. Também aceitamos aliases como key, camelot, comment e name.
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
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight">
                Preview da importação
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                As primeiras linhas válidas do CSV aparecem aqui antes da gravação.
              </p>
            </div>

            <button
              type="button"
              onClick={handleImport}
              disabled={rows.length === 0 || isPending}
              className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Importando..." : `Importar ${rows.length} track(s)`}
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-400">
              Nenhuma linha pronta para preview.
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
                  {previewRows.map((row, index) => (
                    <tr
                      key={`${row.title}-${index}`}
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

          {rows.length > 8 ? (
            <p className="mt-3 text-xs text-slate-400">
              Mostrando 8 de {rows.length} linhas válidas.
            </p>
          ) : null}
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black tracking-tight">
            Exemplo de CSV
          </h2>

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