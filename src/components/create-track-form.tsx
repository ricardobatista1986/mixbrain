"use client";

import { useState, useTransition } from "react";
import { createTrack } from "@/app/app/tracks/actions";

export function CreateTrackForm() {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setErrorMessage("");
    setSuccessMessage("");

    startTransition(async () => {
      try {
        await createTrack(formData);
        setSuccessMessage("Track cadastrada com sucesso.");
        const form = document.getElementById("create-track-form") as HTMLFormElement | null;
        form?.reset();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível cadastrar a track.",
        );
      }
    });
  }

  return (
    <section className="rounded-3xl border border-claude-border bg-claude-surface/70 p-6 shadow-2xl shadow-claude-bg/20">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-claude-accent">
          Nova track
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-claude-text">
          Adicionar à biblioteca
        </h2>
        <p className="mt-3 text-sm leading-7 text-claude-text-muted sm:text-base">
          Registre as informações mínimas da faixa para começar a montar seu
          catálogo pessoal.
        </p>
      </div>

      <form id="create-track-form" action={handleSubmit} className="mt-8 grid gap-5">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              Título
            </span>
            <input
              type="text"
              name="title"
              required
              maxLength={200}
              placeholder="Ex.: The Sky Was Pink"
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              Artista
            </span>
            <input
              type="text"
              name="artist"
              required
              maxLength={200}
              placeholder="Ex.: Nathan Fake"
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
            />
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              BPM
            </span>
            <input
              type="number"
              name="bpm"
              min={1}
              step={0.01}
              placeholder="124"
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              Tonalidade
            </span>
            <input
              type="text"
              name="musicalKey"
              maxLength={32}
              placeholder="8A / Am"
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              Energia
            </span>
            <input
              type="number"
              name="energy"
              min={1}
              max={10}
              step={1}
              placeholder="7"
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
            />
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              Mood
            </span>
            <input
              type="text"
              name="mood"
              maxLength={120}
              placeholder="Hipnótico, melancólico, eufórico..."
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              Origem
            </span>
            <input
              type="text"
              name="source"
              maxLength={120}
              placeholder="Bandcamp, Beatport, arquivo local..."
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-claude-text-muted">
            Observações
          </span>
          <textarea
            name="notes"
            rows={4}
            placeholder="Ex.: ótima para abertura; break longo; bassline entra bem depois de transição percussiva."
            className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
          />
        </label>

        <details className="rounded-xl border border-claude-border bg-claude-bg px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-claude-text-muted hover:text-claude-text">
            Features de áudio (avançado)
          </summary>
          <p className="mt-2 text-xs text-claude-text-faint">
            Escala 0 a 1 (padrão Spotify). Normalmente vêm do CSV — preencha manualmente só se
            souber os valores. Alimentam os fatores &quot;Textura vocal&quot; e &quot;Groove e
            clima&quot; do score.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["danceability", "Danceability"],
                ["valence", "Valence"],
                ["instrumentalness", "Instrumentalness"],
                ["speechiness", "Speechiness"],
                ["acousticness", "Acousticness"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block">
                <span className="mb-1 block text-xs font-medium text-claude-text-muted">
                  {label}
                </span>
                <input
                  type="number"
                  name={field}
                  min={0}
                  max={1}
                  step={0.01}
                  className="w-full rounded-lg border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none focus:border-claude-accent"
                />
              </label>
            ))}
          </div>
        </details>

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
            className="rounded-xl bg-claude-accent px-5 py-3 font-bold text-claude-bg transition hover:bg-claude-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Salvando..." : "Cadastrar track"}
          </button>

          <p className="text-sm text-claude-text-faint">
            Esta track ficará disponível para seleção futura em projetos.
          </p>
        </div>
      </form>
    </section>
  );
}