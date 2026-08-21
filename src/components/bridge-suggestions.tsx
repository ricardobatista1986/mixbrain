"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCandidatesBulk } from "@/app/app/projetos/[id]/actions";

export type BridgeSuggestionTrack = {
  id: string;
  title: string;
  artist: string;
  bpm: number | null;
  musical_key: string | null;
  score: number;
};

export function BridgeSuggestions({
  projectId,
  suggestions,
}: {
  projectId: string;
  suggestions: BridgeSuggestionTrack[];
}) {
  const router = useRouter();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (suggestions.length === 0) return null;

  function handleAdd(trackId: string) {
    setError("");

    startTransition(async () => {
      try {
        await addCandidatesBulk(projectId, [trackId]);
        setAddedIds((current) => new Set(current).add(trackId));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível adicionar.");
      }
    });
  }

  return (
    <details className="mt-3 rounded-lg border border-violet-300/20 bg-violet-300/[0.04] p-3">
      <summary className="cursor-pointer text-xs font-bold text-violet-200">
        💡 Sugestões de bridge para essa transição
      </summary>
      <p className="mt-2 text-[11px] leading-4 text-violet-200/70">
        Tracks da biblioteca que fariam uma ponte melhor entre essas duas —
        combinam razoavelmente bem entrando depois da primeira e saindo antes
        da segunda.
      </p>
      <div className="mt-3 space-y-1.5">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-claude-border/60 bg-claude-surface/40 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-claude-text">
                {suggestion.artist} — {suggestion.title}
              </p>
              <p className="text-[11px] text-claude-text-faint">
                {suggestion.bpm ? `${suggestion.bpm} BPM` : ""}{" "}
                {suggestion.musical_key ?? ""} · encaixe médio {suggestion.score}%
              </p>
            </div>
            {addedIds.has(suggestion.id) ? (
              <span className="shrink-0 text-[11px] font-bold text-emerald-300">
                ✓ Adicionada
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleAdd(suggestion.id)}
                disabled={isPending}
                className="shrink-0 rounded-lg border border-violet-300/30 px-2 py-1 text-[11px] font-bold text-violet-200 hover:bg-violet-300/10 disabled:opacity-60"
              >
                Adicionar
              </button>
            )}
          </div>
        ))}
      </div>
      {error ? <p className="mt-2 text-[11px] text-rose-300">{error}</p> : null}
    </details>
  );
}
