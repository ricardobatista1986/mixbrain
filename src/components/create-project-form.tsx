"use client";

import { useState, useTransition } from "react";
import { createSetProject } from "@/app/app/actions";

export function CreateProjectForm() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setErrorMessage("");

    startTransition(async () => {
      try {
        await createSetProject(formData);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível criar o projeto.",
        );
      }
    });
  }

  return (
    <section className="rounded-3xl border border-claude-border bg-claude-surface/70 p-6 shadow-2xl shadow-claude-bg/20">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-claude-accent">
          Novo projeto
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-claude-text">
          Criar projeto de set
        </h2>
        <p className="mt-3 text-sm leading-7 text-claude-text-muted sm:text-base">
          Dê um nome ao projeto e, se quiser, adicione uma descrição e uma
          duração alvo inicial.
        </p>
      </div>

      <form action={handleSubmit} className="mt-8 grid gap-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-claude-text-muted">
            Nome do projeto
          </span>
          <input
            type="text"
            name="name"
            required
            maxLength={160}
            placeholder="Ex.: Warm Up Julho 2026"
            className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-claude-text-muted">
            Descrição
          </span>
          <textarea
            name="description"
            rows={4}
            placeholder="Objetivo narrativo, contexto do set, pista, clima ou recorte de curadoria."
            className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-claude-text-muted">
            Duração alvo em minutos
          </span>
          <input
            type="number"
            name="targetDurationMinutes"
            min={1}
            step={1}
            placeholder="Ex.: 90"
            className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-claude-accent px-5 py-3 font-bold text-claude-bg transition hover:bg-claude-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Criando..." : "Criar projeto"}
          </button>

          <p className="text-sm text-claude-text-faint">
            O projeto será salvo diretamente no seu Supabase privado.
          </p>
        </div>
      </form>
    </section>
  );
}