export type EnergyPoint = {
  position: number;
  title: string;
  energy: number | null;
  moment: string | null;
};

/** Mesmo formato de TargetEnergyCurve em lib/mixbrain/auto-sequence, sem
 * importar o módulo inteiro aqui (esse componente é client, o cálculo de
 * interpolação já foi feito no server antes de chegar nesses props). */
export type TargetCurvePoint = {
  positionPercent: number;
  energy: number;
};

const MOMENT_COLORS: Record<string, string> = {
  opening: "bg-claude-accent",
  build: "bg-emerald-400",
  valley: "bg-claude-text-faint",
  peak: "bg-rose-400",
  contemplation: "bg-violet-400",
  closing: "bg-amber-400",
};

const MOMENT_LABELS: Record<string, string> = {
  opening: "Abertura",
  build: "Construção",
  valley: "Vale",
  peak: "Pico",
  contemplation: "Contemplação",
  closing: "Encerramento",
};

export function EnergyArcChart({
  points,
  targetCurve,
}: {
  points: EnergyPoint[];
  targetCurve?: TargetCurvePoint[];
}) {
  const withEnergy = points.filter((point) => point.energy !== null);

  if (withEnergy.length < 2) {
    return null;
  }

  const usedMoments = [...new Set(points.map((p) => p.moment).filter(Boolean))] as string[];
  const hasTarget = targetCurve && targetCurve.length > 0;

  return (
    <section className="rounded-3xl border border-claude-border bg-claude-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
        Mapa temporal do set
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight">Arco de energia</h2>
      <p className="mt-2 text-sm text-claude-text-muted">
        Energia de cada track na ordem da tracklist, colorida pelo momento
        curatorial quando definido. Passe o mouse numa barra para ver a track.
        {hasTarget
          ? " A linha tracejada é a curva de energia alvo definida em Configurações."
          : " Defina uma curva de energia alvo em \"Configurações & Histórico\" para comparar aqui."}
      </p>

      <div className="relative mt-6 h-40 overflow-x-auto pb-2">
        <div className="flex h-full min-w-full items-end gap-1">
          {points.map((point) => {
            const heightPercent = point.energy !== null ? (point.energy / 10) * 100 : 4;
            const color =
              point.moment && MOMENT_COLORS[point.moment]
                ? MOMENT_COLORS[point.moment]
                : "bg-claude-surface-3";

            return (
              <div
                key={point.position}
                title={`${point.position}. ${point.title}${
                  point.energy !== null ? ` — energia ${point.energy}/10` : ""
                }${point.moment ? ` — ${MOMENT_LABELS[point.moment] ?? point.moment}` : ""}`}
                className="group relative flex h-full min-w-[6px] flex-1 items-end"
              >
                <div
                  className={`w-full rounded-t transition ${color} opacity-70 group-hover:opacity-100`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {hasTarget ? (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            viewBox="0 0 100 100"
          >
            <polyline
              points={targetCurve
                .map((p) => `${p.positionPercent},${100 - (p.energy / 10) * 100}`)
                .join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3,2"
              vectorEffect="non-scaling-stroke"
              className="text-amber-300"
            />
          </svg>
        ) : null}
      </div>

      {usedMoments.length > 0 || hasTarget ? (
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-claude-text-muted">
          {hasTarget ? (
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3.5 border-t-2 border-dashed border-amber-300" />
              Curva alvo
            </span>
          ) : null}
          {usedMoments.map((moment) => (
            <span key={moment} className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${MOMENT_COLORS[moment] ?? "bg-claude-surface-3"}`}
              />
              {MOMENT_LABELS[moment] ?? moment}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
