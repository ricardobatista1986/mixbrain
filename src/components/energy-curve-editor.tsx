"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTargetEnergyCurve } from "@/app/app/projetos/[id]/actions";

const CHECKPOINTS = [
  { key: "p0", label: "Início (0%)" },
  { key: "p25", label: "25%" },
  { key: "p50", label: "Meio (50%)" },
  { key: "p75", label: "75%" },
  { key: "p100", label: "Final (100%)" },
] as const;

export function EnergyCurveEditor({
  projectId,
  currentCurve,
}: {
  projectId: string;
  currentCurve: (number | null)[] | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    CHECKPOINTS.forEach((cp, index) => {
      const value = currentCurve?.[index];
      initial[cp.key] = value !== null && value !== undefined ? String(value) : "";
    });
    return initial;
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError("");
    setMessage("");

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("project_id", projectId);
        for (const cp of CHECKPOINTS) {
          formData.set(cp.key, values[cp.key] ?? "");
        }
        await updateTargetEnergyCurve(formData);
        setMessage("Curva salva. A próxima organização automática vai tentar seguir esse arco.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar a curva.");
      }
    });
  }

  function handleClear() {
    const cleared: Record<string, string> = {};
    CHECKPOINTS.forEach((cp) => (cleared[cp.key] = ""));
    setValues(cleared);
  }

  return (
    <section className="rounded-3xl border border-claude-border bg-claude-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-claude-accent">
        Mapa temporal do set
      </p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-claude-text">
        Curva de energia alvo
      </h2>
      <p className="mt-2 text-sm text-claude-text-muted">
        Defina a energia (1–10) que você quer em cada ponto do set. O
        &quot;Gerar ordem automática&quot; passa a tentar seguir esse arco, além
        de maximizar o score entre tracks vizinhas. Deixe em branco os pontos
        sem preferência.
      </p>

      <div className="mt-5 grid grid-cols-5 gap-2">
        {CHECKPOINTS.map((cp) => (
          <label key={cp.key} className="block">
            <span className="mb-1 block text-center text-[10px] font-medium text-claude-text-faint">
              {cp.label}
            </span>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={values[cp.key]}
              onChange={(e) =>
                setValues((current) => ({ ...current, [cp.key]: e.target.value }))
              }
              placeholder="—"
              className="w-full rounded-lg border border-claude-border bg-claude-surface-2 px-2 py-2 text-center text-sm text-claude-text outline-none focus:border-claude-accent"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex h-16 items-end gap-1">
        {CHECKPOINTS.map((cp) => {
          const raw = values[cp.key];
          const numeric = raw ? Number(raw) : null;
          const height = numeric ? (numeric / 10) * 100 : 0;
          return (
            <div key={cp.key} className="flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-claude-accent/70 transition-all"
                style={{ height: `${height}%`, minHeight: numeric ? "4px" : "0" }}
              />
            </div>
          );
        })}
      </div>

      {message ? (
        <p className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
          ✓ {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-xl bg-claude-accent px-4 py-2 text-sm font-bold text-claude-on-accent transition hover:bg-claude-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar curva"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={isPending}
          className="rounded-xl border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted hover:text-claude-text"
        >
          Limpar (sem alvo)
        </button>
      </div>
    </section>
  );
}
