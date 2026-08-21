const EVENT_LABELS: Record<string, { label: string; icon: string }> = {
  track_included: { label: "Track aprovada na tracklist", icon: "✓" },
  track_removed: { label: "Track removida da tracklist", icon: "✕" },
  track_moved: { label: "Track movida", icon: "↕" },
  block_frozen: { label: "Bloco congelado criado", icon: "❄️" },
  block_unfrozen: { label: "Bloco desfeito", icon: "🔓" },
  transition_approved: { label: "Transição aprovada", icon: "👍" },
  transition_rejected: { label: "Transição rejeitada", icon: "👎" },
  set_version_saved: { label: "Versão salva", icon: "💾" },
  set_version_restored: { label: "Versão restaurada", icon: "⏮" },
};

export type CurationEventSummary = {
  id: string;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function describePayload(eventType: string, payload: Record<string, unknown> | null) {
  if (!payload) return null;

  if (eventType === "set_version_saved" && typeof payload.name === "string") {
    return `"${payload.name}"`;
  }
  if (eventType === "block_frozen" && typeof payload.block_name === "string") {
    return `"${payload.block_name}"${
      typeof payload.item_count === "number" ? ` (${payload.item_count} tracks)` : ""
    }`;
  }
  if (
    (eventType === "transition_approved" || eventType === "transition_rejected") &&
    typeof payload.explanation === "string" &&
    payload.explanation
  ) {
    return `"${payload.explanation}"`;
  }
  if (eventType === "set_version_restored" && typeof payload.restored_count === "number") {
    return `${payload.restored_count} track(s)`;
  }

  return null;
}

export function CurationTimeline({ events }: { events: CurationEventSummary[] }) {
  if (events.length === 0) {
    return (
      <section className="rounded-3xl border border-claude-border bg-claude-surface p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
          Timeline
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">
          Histórico de curadoria
        </h2>
        <p className="mt-4 text-sm text-claude-text-faint">
          Nenhum evento registrado ainda. Aprovar candidatas, congelar blocos,
          aprovar/rejeitar transições e salvar versões passam a aparecer aqui.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-claude-border bg-claude-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
        Timeline
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight">
        Histórico de curadoria
      </h2>

      <div className="mt-5 max-h-[400px] space-y-1 overflow-y-auto pr-1">
        {events.map((event) => {
          const meta = EVENT_LABELS[event.eventType] ?? { label: event.eventType, icon: "•" };
          const detail = describePayload(event.eventType, event.payload);

          return (
            <div
              key={event.id}
              className="flex items-start gap-3 rounded-lg border border-claude-border/60 bg-claude-surface/40 px-3 py-2"
            >
              <span className="text-sm" aria-hidden="true">
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-claude-text">
                  {meta.label}
                  {detail ? <span className="font-normal text-claude-text-muted"> — {detail}</span> : null}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-claude-text-faint">
                {formatDate(event.createdAt)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
