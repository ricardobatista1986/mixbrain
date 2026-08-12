"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeCandidate,
  removeCandidatesBulk,
} from "@/app/app/projetos/[id]/actions";

export type OutlierCandidate = {
  candidateId: string;
  title: string;
  artist: string;
  reason: string;
};

export function OutlierCandidatesBox({
  projectId,
  candidates,
}: {
  projectId: string;
  candidates: OutlierCandidate[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (candidates.length === 0) {
    return null;
  }

  function handleRemoveOne(candidateId: string) {
    setError("");
    startTransition(async () => {
      try {
        await removeCandidate(projectId, candidateId);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível remover a candidata."
        );
      }
    });
  }

  function handleRemoveAll() {
    setError("");
    startTransition(async () => {
      try {
        await removeCandidatesBulk(
          projectId,
          candidates.map((c) => c.candidateId)
        );
        setConfirmingAll(false);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível remover as candidatas."
        );
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/[0.05] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-amber-100">
            Fora do padrão do set ({candidates.length})
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-200/70">
            BPM bem diferente do restante das candidatas ou da faixa definida
            no projeto. Não foram removidas automaticamente — decida track por
            track, ou remova todas de uma vez.
          </p>
        </div>

        {!confirmingAll ? (
          <button
            type="button"
            onClick={() => setConfirmingAll(true)}
            className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-300/10"
          >
            Remover todas
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRemoveAll}
              disabled={isPending}
              className="rounded-lg bg-rose-400 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-rose-300 disabled:opacity-60"
            >
              {isPending ? "Removendo..." : `Confirmar remoção de ${candidates.length}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingAll(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {candidates.map((candidate) => (
          <div
            key={candidate.candidateId}
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-300/15 bg-slate-950/40 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">
                {candidate.title}
              </p>
              <p className="truncate text-xs text-slate-400">{candidate.artist}</p>
              <p className="mt-1 text-[11px] text-amber-300/80">{candidate.reason}</p>
            </div>
            <button
              type="button"
              onClick={() => handleRemoveOne(candidate.candidateId)}
              disabled={isPending}
              className="shrink-0 text-xs text-rose-300 hover:text-rose-200 disabled:opacity-60"
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
