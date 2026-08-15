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

type SortKey = "recent" | "artist" | "title" | "bpm" | "energy";

function formatBpm(value: number | null) {
  if (value === null) return "—";
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

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
      className="grid gap-3 border-t border-claude-border bg-claude-surface-2 p-4"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-claude-text-muted">Título</span>
          <input
            type="text"
            name="title"
            required
            maxLength={200}
            defaultValue={track.title}
            className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-claude-text-muted">Artista</span>
          <input
            type="text"
            name="artist"
            required
            maxLength={200}
            defaultValue={track.artist}
            className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-claude-text-muted">BPM</span>
          <input
            type="number"
            name="bpm"
            min={1}
            step={0.01}
            defaultValue={track.bpm ?? ""}
            className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-claude-text-muted">Tonalidade</span>
          <input
            type="text"
            name="musicalKey"
            maxLength={32}
            defaultValue={track.musical_key ?? ""}
            className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-claude-text-muted">Energia</span>
          <input
            type="number"
            name="energy"
            min={1}
            max={10}
            step={1}
            defaultValue={track.energy ?? ""}
            className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-claude-text-muted">Mood</span>
          <input
            type="text"
            name="mood"
            maxLength={120}
            defaultValue={track.mood ?? ""}
            className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-claude-text-muted">Origem</span>
          <input
            type="text"
            name="source"
            maxLength={120}
            defaultValue={track.source ?? ""}
            className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-claude-text-muted">Observações</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={track.notes ?? ""}
          className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
        />
      </label>

      {errorMessage ? (
        <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-200">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-claude-accent px-4 py-2 text-xs font-bold text-claude-on-accent transition hover:bg-claude-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={isPending}
          className="rounded-lg border border-claude-border px-4 py-2 text-xs font-medium text-claude-text-muted hover:text-claude-text"
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
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(true);
        }}
        className="text-xs text-rose-400 hover:text-rose-300"
      >
        Excluir
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {error ? <span className="text-[11px] text-rose-300">{error}</span> : null}
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-xs font-bold text-rose-300 hover:text-rose-200 disabled:opacity-60"
      >
        {isPending ? "..." : "Confirmar"}
      </button>
      <button
        type="button"
        onClick={() => {
          setConfirming(false);
          setError("");
        }}
        disabled={isPending}
        className="text-xs text-claude-text-muted hover:text-claude-text"
      >
        Cancelar
      </button>
    </span>
  );
}

export function TracksLibrary({ tracks }: { tracks: LibraryTrack[] }) {
  const [query, setQuery] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [energyMin, setEnergyMin] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [editingId, setEditingId] = useState<string | null>(null);

  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const track of tracks) {
      if (track.musical_key) keys.add(track.musical_key);
    }
    return [...keys].sort();
  }, [tracks]);

  const filtered = useMemo(() => {
    const minEnergy = energyMin.trim() ? Number(energyMin) : null;

    const result = tracks
      .filter((track) => matchesQuery(track, query))
      .filter((track) => !keyFilter || track.musical_key === keyFilter)
      .filter((track) => minEnergy === null || (track.energy ?? 0) >= minEnergy);

    const sorted = [...result];
    switch (sortKey) {
      case "artist":
        sorted.sort((a, b) => a.artist.localeCompare(b.artist, "pt-BR"));
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
        break;
      case "bpm":
        sorted.sort((a, b) => (b.bpm ?? -1) - (a.bpm ?? -1));
        break;
      case "energy":
        sorted.sort((a, b) => (b.energy ?? -1) - (a.energy ?? -1));
        break;
      case "recent":
      default:
        sorted.sort((a, b) =>
          (b.created_at ?? "").localeCompare(a.created_at ?? "")
        );
        break;
    }

    return sorted;
  }, [tracks, query, keyFilter, energyMin, sortKey]);

  return (
    <section className="flex h-full flex-col rounded-3xl border border-claude-border bg-claude-surface">
      <div className="border-b border-claude-border p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-claude-accent">
          Catálogo atual
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-claude-text">
          {tracks.length} tracks cadastradas
        </h2>

        {tracks.length > 0 ? (
          <div className="mt-5 space-y-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título, artista, key, mood..."
              className="w-full rounded-xl border border-claude-border bg-claude-surface-2 px-4 py-2.5 text-sm text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent"
            />

            <div className="flex flex-wrap gap-2">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-lg border border-claude-border bg-claude-surface-2 px-3 py-1.5 text-xs text-claude-text outline-none"
              >
                <option value="recent">Mais recentes</option>
                <option value="artist">Artista (A–Z)</option>
                <option value="title">Título (A–Z)</option>
                <option value="bpm">BPM (maior primeiro)</option>
                <option value="energy">Energia (maior primeiro)</option>
              </select>

              <select
                value={keyFilter}
                onChange={(e) => setKeyFilter(e.target.value)}
                className="rounded-lg border border-claude-border bg-claude-surface-2 px-3 py-1.5 text-xs text-claude-text outline-none"
              >
                <option value="">Todas as keys</option>
                {availableKeys.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                max={10}
                value={energyMin}
                onChange={(e) => setEnergyMin(e.target.value)}
                placeholder="Energia mín."
                className="w-28 rounded-lg border border-claude-border bg-claude-surface-2 px-3 py-1.5 text-xs text-claude-text outline-none"
              />
            </div>

            {query || keyFilter || energyMin ? (
              <p className="text-xs text-claude-text-faint">
                {filtered.length} de {tracks.length} tracks correspondem ao filtro.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {tracks.length === 0 ? (
        <div className="p-6">
          <div className="rounded-2xl border border-dashed border-claude-border bg-claude-surface-2 p-6">
            <p className="text-sm leading-7 text-claude-text-muted">
              Nenhuma track cadastrada ainda. Use o formulário ao lado para criar a
              primeira entrada da biblioteca.
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-6">
          <div className="rounded-2xl border border-dashed border-claude-border bg-claude-surface-2 p-6">
            <p className="text-sm leading-7 text-claude-text-muted">
              Nenhuma track corresponde à busca &quot;{query}&quot;.
            </p>
          </div>
        </div>
      ) : (
        <div className="max-h-[640px] flex-1 overflow-y-auto">
          {filtered.map((track, index) => (
            <div key={track.id} className="border-b border-claude-border last:border-b-0">
              <div
                onClick={() =>
                  setEditingId((current) => (current === track.id ? null : track.id))
                }
                className="flex cursor-pointer items-center gap-4 px-6 py-3 transition hover:bg-claude-surface-2"
              >
                <span className="w-5 shrink-0 text-right text-xs text-claude-text-faint">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-claude-text">
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-claude-text-muted">{track.artist}</p>
                </div>

                <div className="hidden shrink-0 items-center gap-4 text-xs text-claude-text-muted sm:flex">
                  <span className="w-16 text-right">{formatBpm(track.bpm)} BPM</span>
                  <span className="w-10">{track.musical_key ?? "—"}</span>
                  <span className="w-16">
                    {track.energy ? `Energia ${track.energy}/10` : "—"}
                  </span>
                  {track.mood ? (
                    <span className="max-w-[140px] truncate rounded-full border border-claude-accent/20 bg-claude-accent/10 px-2 py-0.5 text-claude-accent">
                      {track.mood}
                    </span>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs font-semibold text-claude-accent">
                    {editingId === track.id ? "Fechar" : "Editar"}
                  </span>
                  <DeleteTrackControl track={track} />
                </div>
              </div>

              {editingId === track.id ? (
                <TrackEditForm track={track} onDone={() => setEditingId(null)} />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
