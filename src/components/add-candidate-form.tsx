"use client";

import { useState, useTransition } from "react";
import { addCandidate } from "@/app/app/projetos/[id]/actions";

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

export function AddCandidateForm({ projectId, availableTracks }: AddCandidateFormProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setErrorMessage("");
    setSuccessMessage("");

    startTransition(async () => {
      try {
        await addCandidate(projectId, formData);
        setSuccessMessage("Candidata adicionada com sucesso.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível adicionar a candidata.",
        );
      }
    });
  }

  if (availableTracks.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Adicionar candidata
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-50">
          Sem tracks disponíveis
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          Todas as tracks da sua biblioteca já foram adicionadas a este projeto,
          ou você ainda não cadastrou nenhuma track. Acesse a{" "}
          <a
            href="/app/tracks"
            className="text-cyan-300 underline-offset-2 hover:underline"
          >
            biblioteca
          </a>{" "}
          para cadastrar novas tracks.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Adicionar candidata
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-50">
          Selecionar track da biblioteca
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">
          Escolha uma track da sua biblioteca para adicioná-la como candidata
          neste projeto.
        </p>
      </div>

      <form action={handleSubmit} className="mt-8 grid gap-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">
            Track
          </span>
          <select
            name="trackId"
            required
            defaultValue=""
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
          >
            <option value="" disabled>
              Selecione uma track...
            </option>
            {availableTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.title} — {track.artist}
                {track.bpm ? ` (${track.bpm} BPM)` : ""}
                {track.energy ? ` [E${track.energy}]` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">
            Observações (opcional)
          </span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Ex.: boa para abertura; transição suave para a próxima..."
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
          />
        </label>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100"
          >
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
            {successMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Adicionando..." : "Adicionar candidata"}
          </button>
        </div>
      </form>
    </section>
  );
}