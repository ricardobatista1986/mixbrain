"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSetProject } from "@/app/app/actions";

type DeleteProjectButtonProps = {
  projectId: string;
  projectName: string;
  /** Para onde navegar depois de excluir. Se omitido, apenas atualiza a lista atual. */
  redirectTo?: string;
  /** Estilo do botão: "icon" para a lista de cards, "full" para a página do projeto. */
  variant?: "icon" | "full";
};

export function DeleteProjectButton({
  projectId,
  projectName,
  redirectTo,
  variant = "icon",
}: DeleteProjectButtonProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDelete(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setError("");

    startTransition(async () => {
      try {
        await deleteSetProject(projectId);
        if (redirectTo) {
          router.push(redirectTo);
          router.refresh();
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Não foi possível excluir o projeto."
        );
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setConfirming(true);
        }}
        className={
          variant === "icon"
            ? "rounded-full border border-claude-border px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:border-rose-300/50 hover:bg-rose-300/10"
            : "rounded-xl border border-rose-400/30 px-4 py-2 text-sm font-bold text-rose-300 transition hover:bg-rose-400/10"
        }
      >
        Excluir projeto
      </button>
    );
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="flex flex-col items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3"
    >
      <p className="text-xs leading-5 text-rose-100">
        Excluir <strong>{projectName}</strong>? Isso apaga candidatas,
        tracklist, blocos e versões deste projeto. As tracks da biblioteca não
        são afetadas. Não pode ser desfeito.
      </p>

      {error ? <p className="text-xs text-rose-200">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Excluindo..." : "Confirmar exclusão"}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setConfirming(false);
            setError("");
          }}
          disabled={isPending}
          className="rounded-lg border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text-muted transition hover:text-white"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
