"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteTrack, updateTrack } from "@/app/app/tracks/actions";
import { TrackMatchesPanel } from "@/components/track-matches-panel";

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

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function TracksLibrary({ tracks }: { tracks: LibraryTrack[] }) {
  const [query, setQuery] = useState("");
  const [artistFilter, setArtistFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [keyFilters, setKeyFilters] = useState<Set<string>>(new Set());
  const [moodFilter, setMoodFilter] = useState("");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
  const [energyMin, setEnergyMin] = useState("");
  const [energyMax, setEnergyMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [matchesForId, setMatchesForId] = useState<string | null>(null);

  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const track of tracks) {
      if (track.musical_key) keys.add(track.musical_key);
    }
    return [...keys].sort();
  }, [tracks]);

  const availableMoods = useMemo(() => {
    const moods = new Set<string>();
    for (const track of tracks) {
      if (track.mood) moods.add(track.mood);
    }
    return [...moods].sort();
  }, [tracks]);

  const filtered = useMemo(() => {
    const min = bpmMin.trim() ? Number(bpmMin) : null;
    const max = bpmMax.trim() ? Number(bpmMax) : null;
    const eMin = energyMin.trim() ? Number(energyMin) : null;
    const eMax = energyMax.trim() ? Number(energyMax) : null;
    const q = query.trim().toLocaleLowerCase("pt-BR");

    const result = tracks
      .filter((track) => {
        if (!q) return true;
        const haystack = [track.title, track.artist, track.musical_key, track.mood, track.notes]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("pt-BR");
        return haystack.includes(q);
      })
      .filter(
        (track) =>
          !artistFilter ||
          track.artist.toLocaleLowerCase("pt-BR").includes(artistFilter.toLocaleLowerCase("pt-BR"))
      )
      .filter(
        (track) =>
          !titleFilter ||
          track.title.toLocaleLowerCase("pt-BR").includes(titleFilter.toLocaleLowerCase("pt-BR"))
      )
      .filter((track) => keyFilters.size === 0 || (track.musical_key && keyFilters.has(track.musical_key)))
      .filter((track) => !moodFilter || track.mood === moodFilter)
      .filter((track) => min === null || (track.bpm !== null && track.bpm >= min))
      .filter((track) => max === null || (track.bpm !== null && track.bpm <= max))
      .filter((track) => eMin === null || (track.energy !== null && track.energy >= eMin))
      .filter((track) => eMax === null || (track.energy !== null && track.energy <= eMax));

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
        sorted.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
        break;
    }

    return sorted;
  }, [
    tracks,
    query,
    artistFilter,
    titleFilter,
    keyFilters,
    moodFilter,
    bpmMin,
    bpmMax,
    energyMin,
    energyMax,
    sortKey,
  ]);

  const activeFilterCount =
    (artistFilter ? 1 : 0) +
    (titleFilter ? 1 : 0) +
    keyFilters.size +
    (moodFilter ? 1 : 0) +
    (bpmMin || bpmMax ? 1 : 0) +
    (energyMin || energyMax ? 1 : 0);

  function clearFilters() {
    setArtistFilter("");
    setTitleFilter("");
    setKeyFilters(new Set());
    setMoodFilter("");
    setBpmMin("");
    setBpmMax("");
    setEnergyMin("");
    setEnergyMax("");
  }

  return (
    <section className="flex h-full flex-col rounded-3xl border border-claude-border bg-claude-surface">
      <div className="border-b border-claude-border p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-claude-accent">
              Catálogo atual
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-claude-text">
              {tracks.length} tracks cadastradas
            </h2>
          </div>
        </div>

        {tracks.length > 0 ? (
          <div className="mt-5 space-y-3">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título, artista, key, mood..."
              className="w-full rounded-xl border border-claude-border bg-claude-surface-2 px-4 py-2.5 text-sm text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent"
            />

            <div className="flex flex-wrap items-center gap-2">
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

              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className="rounded-lg border border-claude-border bg-claude-surface-2 px-3 py-1.5 text-xs font-semibold text-claude-text transition hover:border-claude-accent/50"
              >
                Filtros {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}{" "}
                {showFilters ? "▲" : "▼"}
              </button>

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-claude-text-faint hover:text-claude-text"
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>

            {showFilters ? (
              <div className="grid gap-3 rounded-xl border border-claude-border bg-claude-surface-2 p-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-claude-text-faint">
                    Artista contém
                  </span>
                  <input
                    type="text"
                    value={artistFilter}
                    onChange={(e) => setArtistFilter(e.target.value)}
                    className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-1.5 text-xs text-claude-text outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-claude-text-faint">
                    Título contém
                  </span>
                  <input
                    type="text"
                    value={titleFilter}
                    onChange={(e) => setTitleFilter(e.target.value)}
                    className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-1.5 text-xs text-claude-text outline-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-claude-text-faint">
                      BPM mín.
                    </span>
                    <input
                      type="number"
                      value={bpmMin}
                      onChange={(e) => setBpmMin(e.target.value)}
                      className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-1.5 text-xs text-claude-text outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-claude-text-faint">
                      BPM máx.
                    </span>
                    <input
                      type="number"
                      value={bpmMax}
                      onChange={(e) => setBpmMax(e.target.value)}
                      className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-1.5 text-xs text-claude-text outline-none"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-claude-text-faint">
                      Energia mín.
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={energyMin}
                      onChange={(e) => setEnergyMin(e.target.value)}
                      className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-1.5 text-xs text-claude-text outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-claude-text-faint">
                      Energia máx.
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={energyMax}
                      onChange={(e) => setEnergyMax(e.target.value)}
                      className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-1.5 text-xs text-claude-text outline-none"
                    />
                  </label>
                </div>

                {availableMoods.length > 0 ? (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-claude-text-faint">
                      Mood
                    </span>
                    <select
                      value={moodFilter}
                      onChange={(e) => setMoodFilter(e.target.value)}
                      className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-1.5 text-xs text-claude-text outline-none"
                    >
                      <option value="">Todos</option>
                      {availableMoods.map((mood) => (
                        <option key={mood} value={mood}>
                          {mood}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {availableKeys.length > 0 ? (
                  <div className="sm:col-span-2">
                    <span className="mb-1 block text-[11px] font-medium text-claude-text-faint">
                      Key (pode marcar mais de uma)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {availableKeys.map((key) => {
                        const active = keyFilters.has(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setKeyFilters((current) => toggleInSet(current, key))}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                              active
                                ? "border-claude-accent bg-claude-accent/15 text-claude-accent"
                                : "border-claude-border text-claude-text-muted hover:border-claude-accent/40"
                            }`}
                          >
                            {key}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {query || activeFilterCount > 0 ? (
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
              Nenhuma track corresponde ao filtro atual.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="hidden items-center gap-4 border-b border-claude-border px-6 py-2 text-[11px] font-bold uppercase tracking-wider text-claude-text-faint sm:flex">
            <span className="w-5 shrink-0" />
            <span className="w-40 shrink-0">Artista</span>
            <span className="min-w-0 flex-1">Título</span>
            <span className="w-16 shrink-0 text-right">BPM</span>
            <span className="w-10 shrink-0">Key</span>
            <span className="w-16 shrink-0">Energia</span>
            <span className="w-32 shrink-0">Mood</span>
            <span className="w-40 shrink-0" />
          </div>

          <div className="max-h-[600px] flex-1 overflow-y-auto">
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

                  <span className="w-40 shrink-0 truncate text-sm font-semibold text-claude-text">
                    {track.artist}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm text-claude-text-muted">
                    {track.title}
                  </span>

                  <span className="hidden w-16 shrink-0 text-right text-xs text-claude-text-muted sm:block">
                    {formatBpm(track.bpm)}
                  </span>
                  <span className="hidden w-10 shrink-0 text-xs text-claude-text-muted sm:block">
                    {track.musical_key ?? "—"}
                  </span>
                  <span className="hidden w-16 shrink-0 text-xs text-claude-text-muted sm:block">
                    {track.energy ? `${track.energy}/10` : "—"}
                  </span>
                  <span className="hidden w-32 shrink-0 truncate text-xs sm:block">
                    {track.mood ? (
                      <span className="rounded-full border border-claude-accent/20 bg-claude-accent/10 px-2 py-0.5 text-claude-accent">
                        {track.mood}
                      </span>
                    ) : (
                      <span className="text-claude-text-faint">—</span>
                    )}
                  </span>

                  <span className="flex w-40 shrink-0 items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMatchesForId((current) => (current === track.id ? null : track.id));
                      }}
                      className="text-xs font-semibold text-claude-accent hover:text-claude-accent-hover"
                    >
                      {matchesForId === track.id ? "Fechar" : "Encaixes"}
                    </button>
                    <span className="text-xs font-semibold text-claude-accent">
                      {editingId === track.id ? "Fechar" : "Editar"}
                    </span>
                    <DeleteTrackControl track={track} />
                  </span>
                </div>

                {editingId === track.id ? (
                  <TrackEditForm track={track} onDone={() => setEditingId(null)} />
                ) : null}

                {matchesForId === track.id ? (
                  <div className="border-t border-claude-border p-4">
                    <TrackMatchesPanel
                      target={track}
                      pools={[{ label: "Biblioteca inteira", tracks }]}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
