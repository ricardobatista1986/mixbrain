"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCandidatesBulk } from "@/app/app/projetos/[id]/actions";

export type SuggestionTrack = {
  id: string;
  title: string;
  artist: string;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
  score: number | null;
};

function scoreLabel(score: number | null) {
  if (score === null) return null;
  if (score >= 85) return { text: "Excelente encaixe", tone: "text-emerald-300" };
  if (score >= 70) return { text: "Bom encaixe", tone: "text-cyan-300" };
  if (score >= 55) return { text: "Encaixe razoável", tone: "text-amber-300" };
  return { text: "Encaixe fraco", tone: "text-rose-300" };
}

export function LibrarySuggestions({
  projectId,
  suggestions,
  hasPool,
}: {
  projectId: string;
  suggestions: SuggestionTrack[];
  hasPool: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedCount = selected.size;

  const orderedSuggestions = useMemo(
    () => [...suggestions].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)),
    [suggestions]
  );

  function toggle(trackId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }

  function handleAddSelected() {
    setError("");
    setMessage("");

    startTransition(async () => {
      try {
        const result = await addCandidatesBulk(projectId, [...selected]);
        setMessage(`${result.added} track(s) adicionada(s) como candidata(s).`);
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível adicionar as tracks."
        );
      }
    });
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-emerald-100">
            Sugestões inteligentes da biblioteca
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-200/70">
            {hasPool
              ? "Tracks da sua biblioteca que combinam bem com o que já está neste projeto (harmonia, energia, BPM e mood)."
              : "O projeto ainda não tem candidatas para comparar — mostrando as tracks mais recentes da biblioteca."}
          </p>
        </div>

        {selectedCount > 0 ? (
          <button
            type="button"
            onClick={handleAddSelected}
            disabled={isPending}
            className="rounded-lg bg-emerald-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Adicionando..."
              : `Adicionar ${selectedCount} selecionada(s)`}
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
          ✓ {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {orderedSuggestions.map((suggestion) => {
          const label = scoreLabel(suggestion.score);
          const isSelected = selected.has(suggestion.id);

          return (
            <label
              key={suggestion.id}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                isSelected
                  ? "border-emerald-300/60 bg-emerald-300/10"
                  : "border-white/10 bg-slate-950/50 hover:border-emerald-300/30"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(suggestion.id)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {suggestion.title}
                </p>
                <p className="truncate text-xs text-slate-400">{suggestion.artist}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span>{suggestion.bpm ? `${suggestion.bpm} BPM` : "BPM —"}</span>
                  <span>{suggestion.musical_key ?? "Key —"}</span>
                  <span>{suggestion.energy ? `E${suggestion.energy}` : "E —"}</span>
                  {label ? (
                    <span className={`font-bold ${label.tone}`}>
                      {label.text}
                      {suggestion.score !== null ? ` (${suggestion.score}%)` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
