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
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Novo projeto
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-50">
          Criar projeto de set
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">
          Dê um nome ao projeto e, se quiser, adicione uma descrição e uma
          duração alvo inicial.
        </p>
      </div>

      <form action={handleSubmit} className="mt-8 grid gap-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">
            Nome do projeto
          </span>
          <input
            type="text"
            name="name"
            required
            maxLength={160}
            placeholder="Ex.: Warm Up Julho 2026"
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">
            Descrição
          </span>
          <textarea
            name="description"
            rows={4}
            placeholder="Objetivo narrativo, contexto do set, pista, clima ou recorte de curadoria."
            className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">
            Duração alvo em minutos
          </span>
          <input
            type="number"
            name="targetDurationMinutes"
            min={1}
            step={1}
            placeholder="Ex.: 90"
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Criando..." : "Criar projeto"}
          </button>

          <p className="text-sm text-slate-500">
            O projeto será salvo diretamente no seu Supabase privado.
          </p>
        </div>
      </form>
    </section>
  );
}