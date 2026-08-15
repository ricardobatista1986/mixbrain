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

export function AddCandidateForm({ projectId, availableTracks }: AddCandidateFormProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [bpmMin, setBpmMin] = useState("");
  const [bpmMax, setBpmMax] = useState("");
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
    const min = bpmMin.trim() ? Number(bpmMin) : null;
    const max = bpmMax.trim() ? Number(bpmMax) : null;

    return availableTracks
      .filter((track) => matchesQuery(track, query))
      .filter((track) => !keyFilter || track.musical_key === keyFilter)
      .filter((track) => {
        if (min !== null && (track.bpm === null || track.bpm < min)) return false;
        if (max !== null && (track.bpm === null || track.bpm > max)) return false;
        return true;
      })
      .sort((a, b) => a.artist.localeCompare(b.artist, "pt-BR") || a.title.localeCompare(b.title, "pt-BR"));
  }, [availableTracks, query, keyFilter, bpmMin, bpmMax]);

  function toggle(trackId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
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
            className="rounded-xl bg-claude-accent px-4 py-2 text-sm font-bold text-claude-bg transition hover:bg-claude-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Adicionando..." : `Adicionar ${selected.size} selecionada(s)`}
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por artista, título, key, BPM..."
          className="rounded-xl border border-claude-border bg-claude-bg px-3 py-2.5 text-sm text-claude-text outline-none transition focus:border-claude-accent"
          autoComplete="off"
        />
        <select
          value={keyFilter}
          onChange={(e) => setKeyFilter(e.target.value)}
          className="rounded-xl border border-claude-border bg-claude-bg px-3 py-2.5 text-sm text-claude-text outline-none"
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
          value={bpmMin}
          onChange={(e) => setBpmMin(e.target.value)}
          placeholder="BPM min"
          className="rounded-xl border border-claude-border bg-claude-bg px-3 py-2.5 text-sm text-claude-text outline-none"
        />
        <input
          type="number"
          value={bpmMax}
          onChange={(e) => setBpmMax(e.target.value)}
          placeholder="BPM max"
          className="rounded-xl border border-claude-border bg-claude-bg px-3 py-2.5 text-sm text-claude-text outline-none"
        />
      </div>

      {(query || keyFilter || bpmMin || bpmMax) && (
        <p className="mt-2 text-xs text-claude-text0">
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
          <p className="py-6 text-center text-sm text-claude-text0">
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
                      {track.artist} <span className="text-claude-text0">—</span>{" "}
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
          <p className="pt-2 text-center text-xs text-claude-text0">
            Mostrando as primeiras 200 de {filtered.length} — refine a busca para ver outras.
          </p>
        ) : null}
      </div>
    </section>
  );
}
