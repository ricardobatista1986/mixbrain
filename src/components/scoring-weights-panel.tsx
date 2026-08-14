"use client";

import { useState, useTransition } from "react";
import type { ScoringWeights } from "@/lib/mixbrain/transition-score";
import { updateScoringWeights } from "@/app/app/projetos/[id]/actions";

const DEFAULT_WEIGHTS: ScoringWeights = { bpm: 7, energy: 13, moment: 22, harmony: 16, texture: 9, diversity: 5, narrative: 28 };
const FIELDS: { key: keyof ScoringWeights; label: string; hint: string }[] = [
  { key: "narrative", label: "Narrativa", hint: "Coerência do arco do set" },
  { key: "moment", label: "Momento / timing", hint: "Relação entre fases curatoriais" },
  { key: "harmony", label: "Harmonia", hint: "Compatibilidade Camelot" },
  { key: "energy", label: "Energia", hint: "Variação de energia" },
  { key: "texture", label: "Textura / mood", hint: "Moods compartilhados" },
  { key: "bpm", label: "BPM", hint: "Diferença de tempo" },
  { key: "diversity", label: "Diversidade", hint: "Variação de artistas" },
];

export function ScoringWeightsPanel({ projectId, initialWeights }: { projectId: string; initialWeights: Partial<ScoringWeights> | null }) {
  const [weights, setWeights] = useState<ScoringWeights>({ ...DEFAULT_WEIGHTS, ...(initialWeights ?? {}) });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  function update(key: keyof ScoringWeights, value: string) {
    const parsed = Number(value);
    setWeights((current) => ({ ...current, [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 }));
    setMessage("");
  }

  function save() {
    setMessage(""); setError("");
    startTransition(async () => {
      try {
        await updateScoringWeights(projectId, weights);
        setMessage("Pesos salvos com sucesso para este projeto.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar os pesos.");
      }
    });
  }

  return <section className="mt-6 rounded-2xl border border-indigo-400/20 bg-indigo-400/[0.04] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">P3 · Personalização</p><h3 className="mt-2 text-lg font-black text-indigo-100">Pesos do score por projeto</h3><p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">Ajuste o que mais importa para este set. Os valores são persistidos no projeto e usados nas próximas avaliações.</p></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${total === 100 ? "border-emerald-300/30 text-emerald-200" : "border-amber-300/30 text-amber-200"}`}>Total: {total}%</span></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{FIELDS.map((field) => <label key={field.key} className="rounded-xl border border-white/10 bg-slate-950/30 p-3"><span className="flex items-center justify-between text-sm font-bold text-slate-200"><span>{field.label}</span><span className="text-indigo-200">{weights[field.key]}%</span></span><span className="mt-1 block text-[11px] text-slate-500">{field.hint}</span><input type="range" min="0" max="100" step="1" value={weights[field.key]} onChange={(event) => update(field.key, event.target.value)} className="mt-3 w-full accent-indigo-300" /><input type="number" min="0" max="100" value={weights[field.key]} onChange={(event) => update(field.key, event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-100" /></label>)}</div>
    {total !== 100 ? <p className="mt-3 text-xs text-amber-200">A soma recomendada é 100%. A média usará os valores relativos informados.</p> : null}
    {message ? <p className="mt-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-emerald-100">{message}</p> : null}{error ? <p className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">{error}</p> : null}
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { setWeights(DEFAULT_WEIGHTS); setMessage(""); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Restaurar padrão</button><button type="button" onClick={save} disabled={pending} className="rounded-lg bg-indigo-300 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-60">{pending ? "Salvando..." : "Salvar pesos"}</button></div>
  </section>;
}
