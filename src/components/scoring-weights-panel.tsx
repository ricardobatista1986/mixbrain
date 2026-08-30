"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateScoringWeights } from "@/app/app/projetos/[id]/actions";
import { DEFAULT_SCORING_WEIGHTS } from "@/lib/mixbrain/transition-score";

const FACTOR_LABELS: { key: keyof typeof DEFAULT_SCORING_WEIGHTS; label: string }[] = [
  { key: "narrative", label: "Narrativa" },
  { key: "timing", label: "Momento da track" },
  { key: "harmony", label: "Harmonia" },
  { key: "energy", label: "Energia" },
  { key: "mood", label: "Textura e mood" },
  { key: "bpm", label: "BPM" },
  { key: "diversity", label: "Diversidade" },
];

type WeightPreset = {
  id: string;
  label: string;
  description: string;
  weights: Record<keyof typeof DEFAULT_SCORING_WEIGHTS, number>;
};

const WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: "default",
    label: "Padrão",
    description: "O critério padrão do MixBrain: harmonia e energia no comando, sem precisar marcar momento curatorial em nada.",
    weights: { ...DEFAULT_SCORING_WEIGHTS },
  },
  {
    id: "peak-time",
    label: "Peak time",
    description: "Pista cheia, sem tempo pra respirar: energia e BPM no comando, narrativa em segundo plano.",
    weights: { narrative: 12, timing: 14, harmony: 20, energy: 24, mood: 6, bpm: 20, diversity: 4 },
  },
  {
    id: "fuzzy",
    label: "Fuzzy (seguro)",
    description: "Prioriza compatibilidade harmônica acima de tudo — transições que nunca soam fora de tom.",
    weights: { narrative: 8, timing: 6, harmony: 42, energy: 14, mood: 10, bpm: 18, diversity: 2 },
  },
  {
    id: "deep",
    label: "Deep / hipnótico",
    description: "Sets longos e lentos: textura e narrativa importam mais que picos de energia.",
    weights: { narrative: 20, timing: 14, harmony: 20, energy: 6, mood: 26, bpm: 12, diversity: 2 },
  },
];

export function ScoringWeightsPanel({
  projectId,
  currentWeights,
}: {
  projectId: string;
  currentWeights: Partial<Record<keyof typeof DEFAULT_SCORING_WEIGHTS, number>>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const { key } of FACTOR_LABELS) {
      initial[key] = currentWeights[key] ?? DEFAULT_SCORING_WEIGHTS[key];
    }
    return initial;
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const total = Object.values(values).reduce((sum, value) => sum + value, 0);

  const activePresetId = WEIGHT_PRESETS.find((preset) =>
    FACTOR_LABELS.every(({ key }) => preset.weights[key] === values[key])
  )?.id;

  function applyPreset(preset: WeightPreset) {
    setValues({ ...preset.weights });
  }

  function handleSave() {
    setError("");
    setMessage("");

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("project_id", projectId);
        for (const key of Object.keys(values)) {
          formData.set(key, String(values[key]));
        }
        await updateScoringWeights(formData);
        setMessage("Pesos salvos. As próximas ordenações e scores usam esses valores.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar os pesos.");
      }
    });
  }

  function handleReset() {
    const defaults: Record<string, number> = {};
    for (const { key } of FACTOR_LABELS) {
      defaults[key] = DEFAULT_SCORING_WEIGHTS[key];
    }
    setValues(defaults);
  }

  return (
    <section className="rounded-3xl border border-claude-border bg-claude-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
        Score de transição
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight">
        Ajustar pesos deste projeto
      </h2>
      <p className="mt-2 text-sm text-claude-text-muted">
        Mude a importância de cada fator no score e na ordenação automática.
        Não precisa somar 100 — é o peso relativo entre os fatores que importa,
        não o valor absoluto. Padrão entre parênteses.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {WEIGHT_PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              disabled={isPending}
              className={`rounded-xl border p-3 text-left transition ${
                isActive
                  ? "border-claude-accent bg-claude-accent/10"
                  : "border-claude-border bg-claude-surface-2 hover:border-claude-accent/40"
              }`}
            >
              <span
                className={`text-sm font-bold ${isActive ? "text-claude-accent" : "text-claude-text"}`}
              >
                {preset.label}
                {isActive ? " ✓" : ""}
              </span>
              <p className="mt-0.5 text-xs leading-5 text-claude-text-muted">
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-claude-text-faint">
        Um preset só preenche os campos abaixo — continue ajustando e clique em
        &quot;Salvar pesos&quot; pra valer.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {FACTOR_LABELS.map(({ key, label }) => (
          <label key={key} className="block">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-claude-text-muted">
              <span>{label}</span>
              <span className="text-claude-text-faint">(padrão: {DEFAULT_SCORING_WEIGHTS[key]})</span>
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={values[key]}
              onChange={(e) =>
                setValues((current) => ({
                  ...current,
                  [key]: Number(e.target.value),
                }))
              }
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
            />
          </label>
        ))}
      </div>

      <p className="mt-3 text-xs text-claude-text-faint">Soma atual: {total}</p>

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

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-xl bg-claude-accent px-4 py-2 text-sm font-bold text-claude-bg transition hover:bg-claude-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar pesos"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isPending}
          className="rounded-xl border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted hover:text-white"
        >
          Restaurar padrão
        </button>
      </div>
    </section>
  );
}
