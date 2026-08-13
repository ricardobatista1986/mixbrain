"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearTransitionDecision,
  recordTransitionDecision,
} from "@/app/app/projetos/[id]/actions";

export type TransitionDecision = {
  status: "approved" | "rejected";
  explanation: string | null;
};

export function TransitionDecisionControls({
  projectId,
  fromTrackId,
  toTrackId,
  decision,
}: {
  projectId: string;
  fromTrackId: string;
  toTrackId: string;
  decision: TransitionDecision | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [explanation, setExplanation] = useState(decision?.explanation ?? "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitDecision(status: "approved" | "rejected") {
    setError("");

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("project_id", projectId);
        formData.set("from_track_id", fromTrackId);
        formData.set("to_track_id", toTrackId);
        formData.set("decision", status);
        formData.set("explanation", explanation);
        await recordTransitionDecision(formData);
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível registrar a decisão."
        );
      }
    });
  }

  function clearDecision() {
    setError("");

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("project_id", projectId);
        formData.set("from_track_id", fromTrackId);
        formData.set("to_track_id", toTrackId);
        await clearTransitionDecision(formData);
        setExplanation("");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível limpar a decisão."
        );
      }
    });
  }

  return (
    <div className="mt-4 border-t border-current/20 pt-3">
      {decision && !editing ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-bold ${
              decision.status === "approved"
                ? "border-emerald-300/30 text-emerald-200"
                : "border-rose-300/30 text-rose-200"
            }`}
          >
            {decision.status === "approved" ? "✓ Transição aprovada" : "✗ Transição rejeitada"}
            {decision.explanation ? ` — ${decision.explanation}` : ""}
          </span>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-bold underline-offset-2 hover:underline"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={clearDecision}
              disabled={isPending}
              className="opacity-70 hover:opacity-100 disabled:opacity-40"
            >
              Limpar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Justificativa (opcional) — por que aprovar ou rejeitar essa transição"
            rows={2}
            className="w-full rounded-lg border border-current/20 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => submitDecision("approved")}
              disabled={isPending}
              className="rounded-lg border border-emerald-300/40 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-60"
            >
              Aprovar transição
            </button>
            <button
              type="button"
              onClick={() => submitDecision("rejected")}
              disabled={isPending}
              className="rounded-lg border border-rose-300/40 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-300/10 disabled:opacity-60"
            >
              Rejeitar transição
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
