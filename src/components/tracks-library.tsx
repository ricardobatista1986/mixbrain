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
};

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
    <form action={handleSubmit} className="mt-4 grid gap-3 rounded-xl border border-cyan-300/20 bg-slate-950/60 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Título</span>
          <input
            type="text"
            name="title"
            required
            maxLength={200}
            defaultValue={track.title}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Artista</span>
          <input
            type="text"
            name="artist"
            required
            maxLength={200}
            defaultValue={track.artist}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">BPM</span>
          <input
            type="number"
            name="bpm"
            min={1}
            step={0.01}
            defaultValue={track.bpm ?? ""}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Tonalidade</span>
          <input
            type="text"
            name="musicalKey"
            maxLength={32}
            defaultValue={track.musical_key ?? ""}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Energia</span>
          <input
            type="number"
            name="energy"
            min={1}
            max={10}
            step={1}
            defaultValue={track.energy ?? ""}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Mood</span>
          <input
            type="text"
            name="mood"
            maxLength={120}
            defaultValue={track.mood ?? ""}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Origem</span>
          <input
            type="text"
            name="source"
            maxLength={120}
            defaultValue={track.source ?? ""}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-400">Observações</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={track.notes ?? ""}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300"
        />
      </label>

      {errorMessage ? (
        <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs text-rose-100">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={isPending}
          className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
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
        className="text-xs text-rose-400 hover:text-rose-300"
      >
        Excluir
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="text-right text-[11px] leading-4 text-rose-200">
        Remove de candidatas/tracklist em todos os projetos.
      </span>
      {error ? <span className="text-[11px] text-rose-300">{error}</span> : null}
      <span className="inline-flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-bold text-rose-300 hover:text-rose-200 disabled:opacity-60"
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
          className="text-xs text-slate-500 hover:text-slate-300"
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

  const filtered = useMemo(
    () => tracks.filter((track) => matchesQuery(track, query)),
    [tracks, query]
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Catálogo atual
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-50">
            {tracks.length} tracks cadastradas
          </h2>
        </div>
      </div>

      {tracks.length > 0 ? (
        <div className="mt-5">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, artista, key, mood..."
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
          />
          {query ? (
            <p className="mt-2 text-xs text-slate-500">
              {filtered.length} de {tracks.length} tracks correspondem à busca.
            </p>
          ) : null}
        </div>
      ) : null}

      {tracks.length > 0 ? (
        filtered.length > 0 ? (
          <div className="mt-6 space-y-4">
            {filtered.map((track) => (
              <article
                key={track.id}
                className="rounded-2xl border border-white/10 bg-slate-950/70 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-slate-100">
                      {track.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">{track.artist}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      {track.energy ? `Energia ${track.energy}/10` : "Sem energia"}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingId((current) => (current === track.id ? null : track.id))
                      }
                      className="text-xs text-cyan-300 hover:text-cyan-200"
                    >
                      {editingId === track.id ? "Fechar" : "Editar"}
                    </button>
                    <DeleteTrackControl track={track} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">BPM</p>
                    <p className="mt-2 text-sm font-semibold text-slate-200">
                      {formatBpm(track.bpm)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Tonalidade
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-200">
                      {track.musical_key?.trim() ? track.musical_key : "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Mood</p>
                    <p className="mt-2 text-sm font-semibold text-slate-200">
                      {track.mood?.trim() ? track.mood : "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Origem</p>
                    <p className="mt-2 text-sm font-semibold text-slate-200">
                      {track.source?.trim() ? track.source : "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Observações
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-200">
                      {track.notes?.trim() ? track.notes : "Sem observações"}
                    </p>
                  </div>
                </div>

                {editingId === track.id ? (
                  <TrackEditForm track={track} onDone={() => setEditingId(null)} />
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6">
            <p className="text-sm leading-7 text-slate-400">
              Nenhuma track corresponde à busca &quot;{query}&quot;.
            </p>
          </div>
        )
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6">
          <p className="text-sm leading-7 text-slate-400">
            Nenhuma track cadastrada ainda. Use o formulário ao lado para criar a
            primeira entrada da biblioteca.
          </p>
        </div>
      )}
    </section>
  );
}
