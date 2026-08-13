"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveSetProject,
  duplicateSetProject,
  unarchiveSetProject,
} from "@/app/app/actions";

export function ProjectCardActions({
  projectId,
  archived,
}: {
  projectId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDuplicate(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError("");

    startTransition(async () => {
      try {
        const result = await duplicateSetProject(projectId);
        router.push(`/app/projetos/${result.newProjectId}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível duplicar."
        );
      }
    });
  }

  function handleToggleArchive(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError("");

    startTransition(async () => {
      try {
        if (archived) {
          await unarchiveSetProject(projectId);
        } else {
          await archiveSetProject(projectId);
        }
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível atualizar o projeto."
        );
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDuplicate}
        disabled={isPending}
        className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 disabled:opacity-60"
      >
        Duplicar
      </button>
      <button
        type="button"
        onClick={handleToggleArchive}
        disabled={isPending}
        className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-amber-300/50 hover:bg-amber-300/10 disabled:opacity-60"
      >
        {archived ? "Reativar" : "Arquivar"}
      </button>
      {error ? <span className="text-xs text-rose-300">{error}</span> : null}
    </div>
  );
}
