"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeCandidate } from "@/app/app/projetos/[id]/actions";

export function RejectCandidateButton({
  projectId,
  candidateId,
}: {
  projectId: string;
  candidateId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleReject() {
    setError("");
    startTransition(async () => {
      try {
        await removeCandidate(projectId, candidateId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível reprovar.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleReject}
        disabled={isPending}
        className="rounded-full border border-claude-border px-4 py-2 text-sm font-bold text-claude-text-muted transition hover:border-red-400/50 hover:text-red-300 disabled:opacity-50"
      >
        {isPending ? "Reprovando…" : "Reprovar"}
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
