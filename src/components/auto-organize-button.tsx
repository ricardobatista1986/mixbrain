"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoOrganizeTracklist } from "@/app/app/projetos/[id]/actions";

export function AutoOrganizeButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleRun() {
    setError("");
    setMessage("");

    startTransition(async () => {
      try {
        const result = await autoOrganizeTracklist(projectId);

        const parts = [`${result.totalCount} track(s) no total`];
        if (result.newCount > 0) {
          parts.push(`${result.newCount} candidata(s) aprovada(s) agora`);
        }
        if (result.blockCount > 0) {
          parts.push(
            `${result.blockCount} bloco(s) congelado(s) preservado(s)`
          );
        }

        setMessage(`Tracklist reorganizada: ${parts.join(", ")}.`);
        setConfirming(false);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível organizar a tracklist."
        );
        setConfirming(false);
      }
    });
  }

  return (
    <div>
      {!confirming ? (
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setError("");
            setConfirming(true);
          }}
          className="rounded-lg bg-indigo-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-indigo-300"
        >
          Gerar ordem automática
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRun}
            disabled={isPending}
            className="rounded-lg bg-indigo-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Organizando..." : "Confirmar e organizar"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
        </div>
      )}

      {message ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100"
        >
          ✓ {message}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
