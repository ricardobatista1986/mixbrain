"use client";

import { useState, useTransition } from "react";
import { createTrack } from "@/app/app/tracks/actions";

const inputClass = "w-full rounded-xl px-4 py-3 outline-none transition";
const inputStyle = {
  background: "var(--mb-canvas-soft)",
  border: "1px solid var(--mb-border)",
  color: "var(--mb-text-primary)",
} as const;

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
    <section
      className="rounded-3xl p-6"
      style={{ border: "1px solid var(--mb-border)", background: "var(--mb-surface)" }}
    >
      <div className="max-w-3xl">
        <p
          className="text-sm font-semibold uppercase tracking-[0.22em]"
          style={{ color: "var(--mb-accent-text)" }}
        >
          Nova track
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight" style={{ color: "var(--mb-text-primary)" }}>
          Adicionar à biblioteca
        </h2>
        <p className="mt-3 text-sm leading-7 sm:text-base" style={{ color: "var(--mb-text-secondary)" }}>
          Registre as informações mínimas da faixa para começar a montar seu
          catálogo pessoal.
        </p>
      </div>

      <form id="create-track-form" action={handleSubmit} className="mt-8 grid gap-5">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium" style={{ color: "var(--mb-text-secondary)" }}>
              Título
            </span>
            <input
              type="text"
              name="title"
              required
              maxLength={200}
              placeholder="Ex.: The Sky Was Pink"
              className={inputClass}
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium" style={{ color: "var(--mb-text-secondary)" }}>
              Artista
            </span>
            <input
              type="text"
              name="artist"
              required
              maxLength={200}
              placeholder="Ex.: Nathan Fake"
              className={inputClass}
              style={inputStyle}
            />
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium" style={{ color: "var(--mb-text-secondary)" }}>
              BPM
            </span>
            <input
              type="number"
              name="bpm"
              min={1}
              step={0.01}
              placeholder="124"
              className={inputClass}
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium" style={{ color: "var(--mb-text-secondary)" }}>
              Tonalidade
            </span>
            <input
              type="text"
              name="musicalKey"
              maxLength={32}
              placeholder="8A / Am"
              className={inputClass}
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium" style={{ color: "var(--mb-text-secondary)" }}>
              Energia
            </span>
            <input
              type="number"
              name="energy"
              min={1}
              max={10}
              step={1}
              placeholder="7"
              className={inputClass}
              style={inputStyle}
            />
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium" style={{ color: "var(--mb-text-secondary)" }}>
              Mood
            </span>
            <input
              type="text"
              name="mood"
              maxLength={120}
              placeholder="Hipnótico, melancólico, eufóri co..."
              className={inputClass}
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium" style={{ color: "var(--mb-text-secondary)" }}>
              Origem
            </span>
            <input
              type="text"
              name="source"
              maxLength={120}
              placeholder="Bandcamp, Beatport, arquivo local..."
              className={inputClass}
              style={inputStyle}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium" style={{ color: "var(--mb-text-secondary)" }}>
            Observações
          </span>
          <textarea
            name="notes"
            rows={4}
            placeholder="Ex.: ótima para abertura; break longo; bassline entra bem depois de transição percussiva."
            className={inputClass}
            style={inputStyle}
          />
        </label>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "var(--mb-danger-soft)", color: "#f7c9c6", border: "1px solid var(--mb-danger)" }}
          >
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "var(--mb-success-soft)", color: "#cfe8d3", border: "1px solid var(--mb-success)" }}
          >
            {successMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl px-5 py-3 font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--mb-accent)", color: "#1c1a19" }}
          >
            {isPending ? "Salvando..." : "Cadastrar track"}
          </button>

          <p className="text-sm" style={{ color: "var(--mb-text-muted)" }}>
            Esta track ficará disponível para seleção futura em projetos.
          </p>
        </div>
      </form>
    </section>
  );
}
