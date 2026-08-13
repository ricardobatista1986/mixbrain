"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteSetVersion,
  restoreSetVersion,
  saveSetVersion,
} from "@/app/app/projetos/[id]/actions";

export type SetVersionSummary = {
  id: string;
  name: string;
  createdAt: string;
  trackCount: number;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SetVersionsPanel({
  projectId,
  versions,
  tracklistEmpty,
}: {
  projectId: string;
  versions: SetVersionSummary[];
  tracklistEmpty: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("Dê um nome para a versão.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("project_id", projectId);
        formData.set("name", name.trim());
        await saveSetVersion(formData);
        setMessage(`Versão "${name.trim()}" salva.`);
        setName("");
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível salvar a versão."
        );
      }
    });
  }

  function handleRestore(versionId: string) {
    setError("");
    setMessage("");

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("project_id", projectId);
        formData.set("version_id", versionId);
        const result = await restoreSetVersion(formData);
        setMessage(
          `Versão restaurada: ${result.restoredCount} track(s)` +
            (result.skippedCount > 0
              ? `, ${result.skippedCount} ignorada(s) (track não existe mais na biblioteca)`
              : "") +
            "."
        );
        setRestoringId(null);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível restaurar a versão."
        );
        setRestoringId(null);
      }
    });
  }

  function handleDelete(versionId: string) {
    setError("");
    setMessage("");

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("project_id", projectId);
        formData.set("version_id", versionId);
        await deleteSetVersion(formData);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível excluir a versão."
        );
      }
    });
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
        Versões
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight">
        Salvar e restaurar snapshots
      </h2>
      <p className="mt-2 text-sm text-slate-400">
        Guarda a tracklist atual (ordem, blocos e momentos) com um nome.
        Restaurar substitui a tracklist atual pela salva — as candidatas
        continuam intactas.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da versão (ex.: Warm up v1)"
          className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || tracklistEmpty}
          title={tracklistEmpty ? "A tracklist está vazia" : undefined}
          className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Salvar versão atual
        </button>
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

      <div className="mt-5 space-y-2">
        {versions.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma versão salva ainda.</p>
        ) : (
          versions.map((version) => (
            <div
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-100">{version.name}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(version.createdAt)} · {version.trackCount} track(s)
                </p>
              </div>

              {restoringId === version.id ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRestore(version.id)}
                    disabled={isPending}
                    className="rounded-lg bg-cyan-300 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
                  >
                    {isPending ? "Restaurando..." : "Confirmar restauração"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestoringId(null)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRestoringId(version.id)}
                    className="text-xs font-bold text-cyan-300 hover:text-cyan-200"
                  >
                    Restaurar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(version.id)}
                    disabled={isPending}
                    className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-60"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
