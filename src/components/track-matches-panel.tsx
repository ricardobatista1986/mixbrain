"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCandidatesBulk } from "@/app/app/projetos/[id]/actions";
import {
  rankTrackMatches,
  type ScoreTrack,
  type ScoringWeights,
  type MatchDirection,
} from "@/lib/mixbrain/transition-score";
import {
  classifyHarmonicRelation,
  classifyEnergyDirection,
  HARMONIC_RELATION_META,
  ENERGY_DIRECTION_META,
  type HarmonicRelation,
  type EnergyDirection,
} from "@/lib/mixbrain/camelot";

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

// "missing_data" e "incompatible" ficam de fora dos chips de filtro: não são
// tipos de transição que alguém escolhe deliberadamente pra conduzir o set,
// são a ausência de uma relação boa.
const FILTERABLE_HARMONIC_RELATIONS: HarmonicRelation[] = [
  "perfect_match",
  "perfect_boost",
  "perfect_drop",
  "energy_boost",
  "scale_change",
  "diagonal_mix",
  "mood_change",
  "jaws_mix",
];

const FILTERABLE_ENERGY_DIRECTIONS: EnergyDirection[] = ["rise", "drop", "stable"];

const RESULTS_LIMIT = 20;

export function TrackMatchesPanel({
  target,
  pools,
  weights,
  projectId,
  existingProjectTrackIds,
}: {
  target: ScoreTrack;
  pools: MatchPool[];
  weights?: ScoringWeights;
  /** Quando presente, cada match ganha um botão "+ Adicionar" que insere a track como candidata desse projeto. */
  projectId?: string;
  /** Tracks já no projeto (tracklist + candidatas) — escondem o botão de adicionar, já que não faz sentido adicionar de novo. */
  existingProjectTrackIds?: Set<string>;
}) {
  const [poolIndex, setPoolIndex] = useState(0);
  const activePool = pools[poolIndex] ?? pools[0];
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [harmonicFilter, setHarmonicFilter] = useState<Set<HarmonicRelation>>(new Set());
  const [energyFilter, setEnergyFilter] = useState<Set<EnergyDirection>>(new Set());
  const [direction, setDirection] = useState<MatchDirection>("after");

  // Rankeia contra o pool inteiro (sem cortar em 20 ainda) e já classifica
  // harmonia/energia de cada match. `direction` é uma escolha explícita do
  // usuário ("o que combina DEPOIS desta track" vs "o que combina ANTES
  // desta track") — duas perguntas distintas, não uma mistura automática
  // dos dois sentidos.
  const rankedWithMeta = useMemo(() => {
    const pool = activePool?.tracks ?? [];
    const ranked = rankTrackMatches(target, pool, weights, Math.max(pool.length, 1), direction);

    return ranked.map((match) => {
      const fromTrack = direction === "after" ? target : match.track;
      const toTrack = direction === "after" ? match.track : target;
      const harmonicRelation = classifyHarmonicRelation(
        fromTrack.musical_key,
        toTrack.musical_key
      );
      const energyDirection = classifyEnergyDirection(fromTrack.energy, toTrack.energy);
      return { ...match, harmonicRelation, energyDirection };
    });
  }, [target, activePool, weights, direction]);

  // Filtra ANTES de cortar em 20 — senão um filtro por "Energy Boost"
  // esconderia a melhor opção desse tipo se ela não estivesse entre as 20
  // melhores em score geral. Filtro vazio (nenhum chip selecionado) = sem
  // filtro nessa dimensão.
  const filteredMatches = useMemo(() => {
    return rankedWithMeta.filter((match) => {
      if (harmonicFilter.size > 0 && !harmonicFilter.has(match.harmonicRelation)) return false;
      if (energyFilter.size > 0 && !energyFilter.has(match.energyDirection)) return false;
      return true;
    });
  }, [rankedWithMeta, harmonicFilter, energyFilter]);

  const matches = filteredMatches.slice(0, RESULTS_LIMIT);
  const isFiltered = harmonicFilter.size > 0 || energyFilter.size > 0;

  function toggleHarmonic(relation: HarmonicRelation) {
    setHarmonicFilter((prev) => {
      const next = new Set(prev);
      if (next.has(relation)) next.delete(relation);
      else next.add(relation);
      return next;
    });
  }

  function toggleEnergy(direction: EnergyDirection) {
    setEnergyFilter((prev) => {
      const next = new Set(prev);
      if (next.has(direction)) next.delete(direction);
      else next.add(direction);
      return next;
    });
  }

  function handleAdd(trackId: string) {
    if (!projectId) return;
    setAddError(null);
    startTransition(async () => {
      try {
        await addCandidatesBulk(projectId, [trackId]);
        setAddedIds((prev) => new Set(prev).add(trackId));
        router.refresh();
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Falha ao adicionar.");
      }
    });
  }

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

      <div className="mt-2 flex gap-1 rounded-full border border-claude-border bg-claude-surface/40 p-1">
        <button
          type="button"
          onClick={() => setDirection("after")}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
            direction === "after"
              ? "bg-claude-accent text-claude-bg"
              : "text-claude-text-muted hover:text-claude-text"
          }`}
        >
          Toca depois de {target.title}
        </button>
        <button
          type="button"
          onClick={() => setDirection("before")}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition ${
            direction === "before"
              ? "bg-claude-accent text-claude-bg"
              : "text-claude-text-muted hover:text-claude-text"
          }`}
        >
          Toca antes de {target.title}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowFilters((prev) => !prev)}
        className="mt-2 text-[11px] font-semibold text-claude-accent hover:text-claude-accent-hover"
      >
        {showFilters ? "▾" : "▸"} Filtrar por tipo de transição
        {isFiltered
          ? ` (${harmonicFilter.size + energyFilter.size} ativo${
              harmonicFilter.size + energyFilter.size === 1 ? "" : "s"
            })`
          : ""}
      </button>

      {showFilters ? (
        <div className="mt-2 space-y-2 rounded-lg border border-claude-border bg-claude-surface/40 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {FILTERABLE_HARMONIC_RELATIONS.map((relation) => {
              const meta = HARMONIC_RELATION_META[relation];
              const active = harmonicFilter.has(relation);
              return (
                <button
                  key={relation}
                  type="button"
                  title={meta.description}
                  onClick={() => toggleHarmonic(relation)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "border-claude-accent bg-claude-accent/15 text-claude-accent"
                      : "border-claude-border text-claude-text-muted hover:border-claude-accent/40"
                  }`}
                >
                  {meta.icon} {meta.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5 border-t border-claude-border pt-2">
            {FILTERABLE_ENERGY_DIRECTIONS.map((direction) => {
              const meta = ENERGY_DIRECTION_META[direction];
              const active = energyFilter.has(direction);
              return (
                <button
                  key={direction}
                  type="button"
                  onClick={() => toggleEnergy(direction)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                    active
                      ? "border-claude-accent bg-claude-accent/15 text-claude-accent"
                      : "border-claude-border text-claude-text-muted hover:border-claude-accent/40"
                  }`}
                >
                  {meta.icon} {meta.label}
                </button>
              );
            })}
          </div>
          {isFiltered ? (
            <button
              type="button"
              onClick={() => {
                setHarmonicFilter(new Set());
                setEnergyFilter(new Set());
              }}
              className="text-[11px] font-semibold text-claude-text-muted underline hover:text-claude-accent"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      ) : null}

      {addError ? (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300">
          {addError}
        </p>
      ) : null}

      {filteredMatches.length === 0 ? (
        <p className="mt-3 text-xs text-claude-text-muted">
          {isFiltered
            ? `Nenhuma track em "${activePool?.label}" bate com esse filtro.`
            : `Nenhuma outra track com dados suficientes pra comparar em "${activePool?.label}".`}
        </p>
      ) : (
        <div className="mt-2 divide-y divide-claude-border">
          {matches.map((match) => {
            const alreadyInProject =
              existingProjectTrackIds?.has(match.track.id) || addedIds.has(match.track.id);
            const harmonicMeta = HARMONIC_RELATION_META[match.harmonicRelation];
            const energyMeta = ENERGY_DIRECTION_META[match.energyDirection];

            return (
              <div key={match.track.id} className="flex items-start gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-claude-text">
                    {match.track.title}
                  </p>
                  <p className="truncate text-xs text-claude-text-muted">
                    {match.track.artist || "Artista não informado"}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-claude-text-faint">
                    <span>{match.track.bpm ? `${match.track.bpm} BPM` : "BPM —"}</span>
                    <span>{match.track.musical_key ?? "Key —"}</span>
                    <span>{match.track.energy ? `E${match.track.energy}` : "E —"}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-claude-text-faint">
                    <span title={harmonicMeta.description}>
                      {harmonicMeta.icon} {harmonicMeta.label}
                    </span>
                    {" · "}
                    <span title={energyMeta.label}>
                      {energyMeta.icon} {energyMeta.label}
                    </span>
                  </p>
                </div>

                {projectId ? (
                  alreadyInProject ? (
                    <span className="shrink-0 text-[11px] text-claude-text-faint">
                      Já no projeto
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAdd(match.track.id)}
                      disabled={isPending}
                      className="shrink-0 rounded-lg border border-claude-accent/40 px-2 py-1 text-[11px] font-bold text-claude-accent transition hover:bg-claude-accent/10 disabled:opacity-50"
                    >
                      + Adicionar
                    </button>
                  )
                ) : null}

                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${
                    TONE_CLASSES[match.score.tone] ?? TONE_CLASSES.slate
                  }`}
                >
                  {match.score.finalScore === null ? "—" : `${match.score.finalScore}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {filteredMatches.length > RESULTS_LIMIT ? (
        <p className="mt-2 text-[11px] text-claude-text-faint">
          Mostrando as {RESULTS_LIMIT} melhores de {filteredMatches.length} que batem com o filtro.
        </p>
      ) : null}

      <p className="mt-2 text-[11px] text-claude-text-faint">
        Sem contexto de narrativa/momento no set — considera harmonia, energia,
        BPM, mood e diversidade.
      </p>
    </div>
  );
}
