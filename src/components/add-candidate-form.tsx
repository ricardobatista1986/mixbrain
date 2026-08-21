"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCandidatesBulk } from "@/app/app/projetos/[id]/actions";

type Track = {
  id: string;
  title: string;
  artist: string;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
};

type AddCandidateFormProps = {
  projectId: string;
  availableTracks: Track[];
};

function matchesQuery(track: Track, query: string) {
  if (!query) return true;
  const haystack = `${track.artist} ${track.title} ${track.musical_key ?? ""} ${
    track.bpm ?? ""
  }`.toLocaleLowerCase("pt-BR");
  return haystack.includes(query.toLocaleLowerCase("pt-BR"));
}

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function AddCandidateForm({ projectId, availableTracks }: AddCandidateFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [keyFilters, setKeyFilters] = useState<Set<string>>(new Set());
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
  const [energyMin, setEnergyMin] = useState("");
  const [energyMax, setEnergyMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const track of availableTracks) {
      if (track.musical_key) keys.add(track.musical_key);
    }
    return [...keys].sort();
  }, [availableTracks]);

  const filtered = useMemo(() => {
    const bMin = bpmMin.trim() ? Number(bpmMin) : null;
    const bMax = bpmMax.trim() ? Number(bpmMax) : null;
    const eMin = energyMin.trim() ? Number(energyMin) : null;
    const eMax = energyMax.trim() ? Number(energyMax) : null;

    return availableTracks
      .filter((track) => matchesQuery(track, query))
      .filter((track) => keyFilters.size === 0 || (track.musical_key && keyFilters.has(track.musical_key)))
      .filter((track) => bMin === null || (track.bpm !== null && track.bpm >= bMin))
      .filter((track) => bMax === null || (track.bpm !== null && track.bpm <= bMax))
      .filter((track) => eMin === null || (track.energy !== null && track.energy >= eMin))
      .filter((track) => eMax === null || (track.energy !== null && track.energy <= eMax))
      .sort((a, b) => a.artist.localeCompare(b.artist, "pt-BR") || a.title.localeCompare(b.title, "pt-BR"));
  }, [availableTracks, query, keyFilters, bpmMin, bpmMax, energyMin, energyMax]);

  const activeFilterCount =
    keyFilters.size + (bpmMin || bpmMax ? 1 : 0) + (energyMin || energyMax ? 1 : 0);

  function clearFilters() {
    setKeyFilters(new Set());
    setBpmMin("");
    setBpmMax("");
    setEnergyMin("");
    setEnergyMax("");
  }

  function toggle(trackId: string) {
    setSelected((current) => toggleInSet(current, trackId));
  }

  function handleAddSelected() {
    setErrorMessage("");
    setSuccessMessage("");

    startTransition(async () => {
      try {
        const result = await addCandidatesBulk(projectId, [...selected]);
        setSuccessMessage(`${result.added} track(s) adicionada(s) como candidata(s).`);
        setSelected(new Set());
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Não foi possível adicionar as tracks."
        );
      }
    });
  }

  if (availableTracks.length === 0) {
    return (
      <section className="rounded-3xl border border-claude-border bg-claude-surface/70 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-claude-accent">
          Adicionar candidata
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-claude-text">
          Sem tracks disponíveis
        </h2>
        <p className="mt-3 text-sm leading-7 text-claude-text-muted">
          Todas as tracks da sua biblioteca já foram adicionadas a este projeto,
          ou você ainda não cadastrou nenhuma track. Acesse a{" "}
          <a
            href="/app/tracks"
            className="text-claude-accent underline-offset-2 hover:underline"
          >
            biblioteca
          </a>{" "}
          para cadastrar novas tracks.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-claude-border bg-claude-surface/70 p-6 shadow-2xl shadow-claude-bg/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-claude-accent">
            Adicionar candidata
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-claude-text">
            Buscar na biblioteca
          </h2>
          <p className="mt-3 text-sm leading-7 text-claude-text-muted">
            Busque por artista, título, key ou BPM. Marque quantas quiser e
            adicione todas de uma vez.
          </p>
        </div>

        {selected.size > 0 ? (
          <button
            type="button"
            onClick={handleAddSelected}
            disabled={isPending}
            className="rounded-xl bg-claude-accent px-4 py-2 text-sm font-bold text-claude-on-accent transition hover:bg-claude-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Adicionando..." : `Adicionar ${selected.size} selecionada(s)`}
          </button>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por artista, título, key, BPM..."
          className="min-w-[220px] flex-1 rounded-xl border border-claude-border bg-claude-bg px-3 py-2.5 text-sm text-claude-text outline-none transition focus:border-claude-accent"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="rounded-xl border border-claude-border bg-claude-bg px-3 py-2.5 text-xs font-semibold text-claude-text transition hover:border-claude-accent/50"
        >
          Filtros {activeFilterCount > 0 ? `(${activeFilterCount})` : ""} {showFilters ? "▲" : "▼"}
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
        <div className="mt-3 grid gap-3 rounded-xl border border-claude-border bg-claude-surface-2 p-4 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-claude-text-faint">
                BPM mín.
              </span>
              <input
                type="number"
                value={bpmMin}
                onChange={(e) => setBpmMin(e.target.value)}
                className="w-full rounded-lg border border-claude-border bg-claude-bg px-3 py-1.5 text-xs text-claude-text outline-none"
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
                className="w-full rounded-lg border border-claude-border bg-claude-bg px-3 py-1.5 text-xs text-claude-text outline-none"
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
                className="w-full rounded-lg border border-claude-border bg-claude-bg px-3 py-1.5 text-xs text-claude-text outline-none"
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
                className="w-full rounded-lg border border-claude-border bg-claude-bg px-3 py-1.5 text-xs text-claude-text outline-none"
              />
            </label>
          </div>

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

      {(query || activeFilterCount > 0) && (
        <p className="mt-2 text-xs text-claude-text-faint">
          {filtered.length} de {availableTracks.length} tracks correspondem ao filtro.
        </p>
      )}

      {errorMessage ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100"
        >
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
          {successMessage}
        </p>
      ) : null}

      <div className="mt-5 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-claude-text-faint">
            Nenhuma track encontrada com esse filtro.
          </p>
        ) : (
          filtered.slice(0, 200).map((track) => {
            const isSelected = selected.has(track.id);
            return (
              <label
                key={track.id}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 transition ${
                  isSelected
                    ? "border-claude-accent/50 bg-claude-accent/10"
                    : "border-claude-border/60 bg-claude-surface/40 hover:border-claude-border"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(track.id)}
                    className="h-4 w-4 shrink-0 rounded border-claude-border bg-claude-surface"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-claude-text">
                      {track.artist} <span className="text-claude-text-faint">—</span>{" "}
                      {track.title}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[11px] text-claude-text-muted">
                  {track.bpm ? <span>{track.bpm} BPM</span> : null}
                  {track.musical_key ? <span>{track.musical_key}</span> : null}
                  {track.energy ? <span>E{track.energy}</span> : null}
                </div>
              </label>
            );
          })
        )}
        {filtered.length > 200 ? (
          <p className="pt-2 text-center text-xs text-claude-text-faint">
            Mostrando as primeiras 200 de {filtered.length} — refine a busca para ver outras.
          </p>
        ) : null}
      </div>
    </section>
  );
}
