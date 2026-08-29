"use client";

import { useMemo, useState } from "react";
import {
  rankTrackMatches,
  type ScoreTrack,
  type ScoringWeights,
} from "@/lib/mixbrain/transition-score";

export type MatchPool = {
  label: string;
  tracks: ScoreTrack[];
};

const TONE_CLASSES: Record<string, string> = {
  emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  cyan: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  rose: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  slate: "border-claude-border text-claude-text-muted",
};

export function TrackMatchesPanel({
  target,
  pools,
  weights,
}: {
  target: ScoreTrack;
  pools: MatchPool[];
  weights?: ScoringWeights;
}) {
  const [poolIndex, setPoolIndex] = useState(0);
  const activePool = pools[poolIndex] ?? pools[0];

  const matches = useMemo(
    () => rankTrackMatches(target, activePool?.tracks ?? [], weights, 12),
    [target, activePool, weights]
  );

  return (
    <div className="rounded-xl border border-claude-border bg-claude-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-claude-text">
          Melhores encaixes para <span className="text-claude-accent">{target.title}</span>
        </p>

        {pools.length > 1 ? (
          <div className="flex gap-1">
            {pools.map((pool, index) => (
              <button
                key={pool.label}
                type="button"
                onClick={() => setPoolIndex(index)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  index === poolIndex
                    ? "border-claude-accent bg-claude-accent/15 text-claude-accent"
                    : "border-claude-border text-claude-text-muted hover:border-claude-accent/40"
                }`}
              >
                {pool.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {matches.length === 0 ? (
        <p className="mt-3 text-xs text-claude-text-muted">
          Nenhuma outra track com dados suficientes pra comparar em &quot;{activePool?.label}&quot;.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-claude-border">
          {matches.map((match) => (
            <div key={match.track.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-claude-text">
                  {match.track.title}
                </p>
                <p className="truncate text-xs text-claude-text-muted">
                  {match.track.artist || "Artista não informado"}
                  {match.direction === "backward" ? " · melhor entrando antes" : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${
                  TONE_CLASSES[match.score.tone] ?? TONE_CLASSES.slate
                }`}
              >
                {match.score.finalScore === null ? "—" : `${match.score.finalScore}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[11px] text-claude-text-faint">
        Sem contexto de narrativa/momento no set — considera harmonia, energia,
        BPM, mood e diversidade. Direção mostrada é a que rende o maior score.
      </p>
    </div>
  );
}
