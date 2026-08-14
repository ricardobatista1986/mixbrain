"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteTrack, updateTrack } from "@/app/app/tracks/actions";

export type LibraryTrack = {
  id: string;
  title: string;
  artist: string;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
  source: string | null;
  notes: string | null;
  created_at?: string;
};

type SortKey = "title" | "artist" | "bpm" | "energy" | "musical_key" | "created_at";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  title: "Título",
  artist: "Artista",
  bpm: "BPM",
  energy: "Energia",
  musical_key: "Tonalidade",
  created_at: "Adicionada em",
};

const inputClass =
  "w-full rounded-lg px-3 py-2 text-sm outline-none transition focus:ring-2";
const inputStyle = {
  background: "var(--mb-canvas-soft)",
  border: "1px solid var(--mb-border)",
  color: "var(--mb-text-primary)",
} as const;

function formatBpm(value: number | null) {
  if (value === null) return "—";
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function normalize(value: string) {
  return value.toLocaleLowerCase("pt-BR");
}

type Filters = {
  minBpm: string;
  maxBpm: string;
  minEnergy: string;
  maxEnergy: string;
  musicalKey: string;
  mood: string;
  source: string;
};

const emptyFilters: Filters = {
  minBpm: "",
  maxBpm: "",
  minEnergy: "",
  maxEnergy: "",
  musicalKey: "",
  mood: "",
  source: "",
};

function matchesQuery(track: LibraryTrack, query: string) {
  if (!query) return true;

  const haystack = [
    track.title,
    track.artist,
    track.musical_key,
    track.mood,
    track.source,
    track.notes,
    track.bpm !== null ? String(track.bpm) : "",
    track.energy !== null ? String(track.energy) : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");

  return haystack.includes(query.toLocaleLowerCase("pt-BR"));
}

function matchesFilters(track: LibraryTrack, filters: Filters) {
  const minBpm = filters.minBpm ? Number(filters.minBpm) : null;
  const maxBpm = filters.maxBpm ? Number(filters.maxBpm) : null;
  const minEnergy = filters.minEnergy ? Number(filters.minEnergy) : null;
  const maxEnergy = filters.maxEnergy ? Number(filters.maxEnergy) : null;

  if (minBpm !== null && (track.bpm === null || track.bpm < minBpm)) return false;
  if (maxBpm !== null && (track.bpm === null || track.bpm > maxBpm)) return false;
  if (minEnergy !== null && (track.energy === null || track.energy < minEnergy)) return false;
  if (maxEnergy !== null && (track.energy === null || track.energy > maxEnergy)) return false;

  if (filters.musicalKey) {
    const key = track.musical_key ?? "";
    if (!normalize(key).includes(normalize(filters.musicalKey))) return false;
  }

  if (filters.mood) {
    const mood = track.mood ?? "";
    if (!normalize(mood).includes(normalize(filters.mood))) return false;
  }

  if (filters.source && filters.source !== "__all__") {
    if ((track.source ?? "Sem origem") !== filters.source) return false;
  }

  return true;
}

function compareTracks(a: LibraryTrack, b: LibraryTrack, sortKey: SortKey, sortDir: SortDir) {
  const dir = sortDir === "asc" ? 1 : -1;

  const getValue = (track: LibraryTrack): string | number => {
    switch (sortKey) {
      case "bpm":
        return track.bpm ?? -1;
      case "energy":
        return track.energy ?? -1;
      case "musical_key":
        return track.musical_key ?? "";
      case "created_at":
        return track.created_at ?? "";
      case "artist":
        return normalize(track.artist ?? "");
      default:
        return normalize(track.title ?? "");
    }
  };

  const valueA = getValue(a);
  const valueB = getValue(b);

  if (typeof valueA === "number" && typeof valueB === "number") {
    return (valueA - valueB) * dir;
  }

  return String(valueA).localeCompare(String(valueB), "pt-BR") * dir;
}

function TrackEditForm({
  track,
  onDone,
}: {
  track: LibraryTrack;
  onDone: () => void;
}) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setErrorMessage("");

    startTransition(async () => {
      try {
        await updateTrack(track.id, formData);
        onDone();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Não foi possível salvar a track."
        );
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="col-span-full mt-2 grid gap-3 rounded-xl p-4"
      style={{ background: "var(--mb-canvas-soft)", border: "1px solid var(--mb-accent-soft)" }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--mb-text-muted)" }}>
            Título
          </span>
          <input type="text" name="title" required maxLength={200} defaultValue={track.title} className={inputClass} style={inputStyle} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--mb-text-muted)" }}>
            Artista
          </span>
          <input type="text" name="artist" required maxLength={200} defaultValue={track.artist} className={inputClass} style={inputStyle} />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--mb-text-muted)" }}>
            BPM
          </span>
          <input type="number" name="bpm" min={1} step={0.01} defaultValue={track.bpm ?? ""} className={inputClass} style={inputStyle} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--mb-text-muted)" }}>
            Tonalidade
          </span>
          <input type="text" name="musicalKey" maxLength={32} defaultValue={track.musical_key ?? ""} className={inputClass} style={inputStyle} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--mb-text-muted)" }}>
            Energia
          </span>
          <input type="number" name="energy" min={1} max={10} step={1} defaultValue={track.energy ?? ""} className={inputClass} style={inputStyle} />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--mb-text-muted)" }}>
            Mood
          </span>
          <input type="text" name="mood" maxLength={120} defaultValue={track.mood ?? ""} className={inputClass} style={inputStyle} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium" style={{ color: "var(--mb-text-muted)" }}>
            Origem
          </span>
          <input type="text" name="source" maxLength={120} defaultValue={track.source ?? ""} className={inputClass} style={inputStyle} />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium" style={{ color: "var(--mb-text-muted)" }}>
          Observações
        </span>
        <textarea name="notes" rows={3} defaultValue={track.notes ?? ""} className={inputClass} style={inputStyle} />
      </label>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: "var(--mb-danger-soft)", color: "#f7c9c6", border: "1px solid var(--mb-danger)" }}
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: "var(--mb-accent)", color: "#1c1a19" }}
        >
          {isPending ? "Salvando..." : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={isPending}
          className="rounded-lg px-4 py-2 text-xs font-medium"
          style={{ border: "1px solid var(--mb-border)", color: "var(--mb-text-secondary)" }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function DeleteTrackControl({ track }: { track: LibraryTrack }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError("");
    startTransition(async () => {
      try {
        await deleteTrack(track.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível excluir.");
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium transition"
        style={{ color: "var(--mb-danger)" }}
      >
        Excluir
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="text-right text-[11px] leading-4" style={{ color: "var(--mb-danger)" }}>
        Remove de candidatas/tracklist em todos os projetos.
      </span>
      {error ? <span className="text-[11px]" style={{ color: "var(--mb-danger)" }}>{error}</span> : null}
      <span className="inline-flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-bold disabled:opacity-60"
          style={{ color: "var(--mb-danger)" }}
        >
          {isPending ? "Excluindo..." : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError("");
          }}
          disabled={isPending}
          className="text-xs"
          style={{ color: "var(--mb-text-muted)" }}
        >
          Cancelar
        </button>
      </span>
    </span>
  );
}

export function TracksLibrary({ tracks }: { tracks: LibraryTrack[] }) {
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sourceOptions = useMemo(() => {
    const values = new Set<string>();
    tracks.forEach((track) => values.add(track.source?.trim() ? track.source : "Sem origem"));
    return Array.from(values).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [tracks]);

  const activeFilterCount = Object.values(filters).filter((value) => value && value !== "__all__").length;

  const filtered = useMemo(() => {
    return tracks
      .filter((track) => matchesQuery(track, query))
      .filter((track) => matchesFilters(track, filters))
      .sort((a, b) => compareTracks(a, b, sortKey, sortDir));
  }, [tracks, query, filters, sortKey, sortDir]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section
      className="flex flex-col rounded-3xl p-6"
      style={{ border: "1px solid var(--mb-border)", background: "var(--mb-surface)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className="text-sm font-semibold uppercase tracking-[0.22em]"
            style={{ color: "var(--mb-accent-text)" }}
          >
            Catálogo atual
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight" style={{ color: "var(--mb-text-primary)" }}>
            {tracks.length} tracks cadastradas
          </h2>
        </div>
        {tracks.length > 0 ? (
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className="rounded-full px-4 py-2 text-xs font-semibold transition"
            style={{
              border: "1px solid var(--mb-border-strong)",
              color: activeFilterCount > 0 ? "var(--mb-accent-text)" : "var(--mb-text-secondary)",
              background: activeFilterCount > 0 ? "var(--mb-accent-soft)" : "transparent",
            }}
          >
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        ) : null}
      </div>

      {tracks.length > 0 ? (
        <div className="mt-5 flex flex-col gap-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, artista, key, mood..."
            className={inputClass}
            style={{ ...inputStyle, padding: "0.75rem 1rem" }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--mb-text-muted)" }}>
              Ordenar por
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="rounded-lg px-2 py-1.5 text-xs"
                style={inputStyle}
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium"
              style={inputStyle}
              title={sortDir === "asc" ? "Crescente" : "Decrescente"}
            >
              {sortDir === "asc" ? "↑ Crescente" : "↓ Decrescente"}
            </button>

            {(query || activeFilterCount > 0) ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilters(emptyFilters);
                }}
                className="text-xs font-medium"
                style={{ color: "var(--mb-accent-text)" }}
              >
                Limpar busca e filtros
              </button>
            ) : null}
          </div>

          {filtersOpen ? (
            <div
              className="grid gap-3 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-3"
              style={{ background: "var(--mb-canvas-soft)", border: "1px solid var(--mb-border)" }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="BPM mín."
                  value={filters.minBpm}
                  onChange={(event) => updateFilter("minBpm", event.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="BPM máx."
                  value={filters.maxBpm}
                  onChange={(event) => updateFilter("maxBpm", event.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  placeholder="Energia mín."
                  value={filters.minEnergy}
                  onChange={(event) => updateFilter("minEnergy", event.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
                <input
                  type="number"
                  min={1}
                  max={10}
                  placeholder="Energia máx."
                  value={filters.maxEnergy}
                  onChange={(event) => updateFilter("maxEnergy", event.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <input
                type="text"
                placeholder="Tonalidade contém..."
                value={filters.musicalKey}
                onChange={(event) => updateFilter("musicalKey", event.target.value)}
                className={inputClass}
                style={inputStyle}
              />

              <input
                type="text"
                placeholder="Mood contém..."
                value={filters.mood}
                onChange={(event) => updateFilter("mood", event.target.value)}
                className={inputClass}
                style={inputStyle}
              />

              <select
                value={filters.source || "__all__"}
                onChange={(event) => updateFilter("source", event.target.value)}
                className={inputClass}
                style={inputStyle}
              >
                <option value="__all__">Todas as origens</option>
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <p className="text-xs" style={{ color: "var(--mb-text-muted)" }}>
            {filtered.length} de {tracks.length} tracks exibidas.
          </p>
        </div>
      ) : null}

      {tracks.length > 0 ? (
        filtered.length > 0 ? (
          <div
            className="mt-4 flex-1 overflow-y-auto rounded-2xl"
            style={{ border: "1px solid var(--mb-border)", maxHeight: "65vh" }}
          >
            <div
              className="grid grid-cols-[2.2fr_0.7fr_0.8fr_0.7fr_1fr_1fr_auto] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{
                position: "sticky",
                top: 0,
                background: "var(--mb-surface-strong)",
                color: "var(--mb-text-muted)",
                borderBottom: "1px solid var(--mb-border)",
              }}
            >
              <span>Título / Artista</span>
              <span>BPM</span>
              <span>Tonalidade</span>
              <span>Energia</span>
              <span>Mood</span>
              <span>Origem</span>
              <span className="text-right">Ações</span>
            </div>

            <div>
              {filtered.map((track) => (
                <div
                  key={track.id}
                  className="grid grid-cols-[2.2fr_0.7fr_0.8fr_0.7fr_1fr_1fr_auto] items-center gap-3 px-4 py-3 text-sm transition"
                  style={{ borderBottom: "1px solid var(--mb-border)" }}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold" style={{ color: "var(--mb-text-primary)" }}>
                      {track.title}
                    </p>
                    <p className="truncate text-xs" style={{ color: "var(--mb-text-muted)" }}>
                      {track.artist}
                    </p>
                  </div>
                  <span style={{ color: "var(--mb-text-secondary)" }}>{formatBpm(track.bpm)}</span>
                  <span style={{ color: "var(--mb-text-secondary)" }}>
                    {track.musical_key?.trim() ? track.musical_key : "—"}
                  </span>
                  <span>
                    {track.energy ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: "var(--mb-accent-soft)", color: "var(--mb-accent-text)" }}
                      >
                        {track.energy}/10
                      </span>
                    ) : (
                      <span style={{ color: "var(--mb-text-muted)" }}>—</span>
                    )}
                  </span>
                  <span className="truncate" style={{ color: "var(--mb-text-secondary)" }}>
                    {track.mood?.trim() ? track.mood : "—"}
                  </span>
                  <span className="truncate" style={{ color: "var(--mb-text-secondary)" }}>
                    {track.source?.trim() ? track.source : "—"}
                  </span>
                  <span className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId((current) => (current === track.id ? null : track.id))
                      }
                      className="text-xs font-medium"
                      style={{ color: "var(--mb-accent-text)" }}
                    >
                      {editingId === track.id ? "Fechar" : "Editar"}
                    </button>
                    <DeleteTrackControl track={track} />
                  </span>

                  {editingId === track.id ? (
                    <TrackEditForm track={track} onDone={() => setEditingId(null)} />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="mt-6 rounded-2xl p-6"
            style={{ border: "1px dashed var(--mb-border)", background: "var(--mb-canvas-soft)" }}
          >
            <p className="text-sm leading-7" style={{ color: "var(--mb-text-secondary)" }}>
              Nenhuma track corresponde à busca ou aos filtros aplicados.
            </p>
          </div>
        )
      ) : (
        <div
          className="mt-6 rounded-2xl p-6"
          style={{ border: "1px dashed var(--mb-border)", background: "var(--mb-canvas-soft)" }}
        >
          <p className="text-sm leading-7" style={{ color: "var(--mb-text-secondary)" }}>
            Nenhuma track cadastrada ainda. Use o formulário ao lado para criar a
            primeira entrada da biblioteca.
          </p>
        </div>
      )}
    </section>
  );
}
