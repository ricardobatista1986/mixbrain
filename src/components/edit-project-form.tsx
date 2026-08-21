"use client";

import { useTransition, useState } from "react";
import { updateSetProject } from "@/app/app/projetos/[id]/actions";

type EditProjectFormProps = {
  project: {
    id: string;
    name: string;
    description: string | null;
    target_duration_minutes: number | null;
    bpm_min: number | null;
    bpm_max: number | null;
    narrative_brief: string | null;
  };
};

export function EditProjectForm({ project }: EditProjectFormProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setErrorMessage("");
    setSuccessMessage("");

    startTransition(async () => {
      try {
        await updateSetProject(project.id, formData);
        setSuccessMessage("Projeto atualizado com sucesso.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível atualizar o projeto.",
        );
      }
    });
  }

  return (
    <section className="rounded-3xl border border-claude-border bg-claude-surface/70 p-6 shadow-2xl shadow-claude-bg/20">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-claude-accent">
          Editar projeto
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-claude-text">
          Ajustar briefing do set
        </h2>
        <p className="mt-3 text-sm leading-7 text-claude-text-muted sm:text-base">
          Atualize o contexto do projeto antes de avançar para biblioteca,
          candidatas e versões.
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
            defaultValue={project.name}
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
            defaultValue={project.description ?? ""}
            className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
          />
        </label>

        <div className="grid gap-5 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              Duração alvo
            </span>
            <input
              type="number"
              name="targetDurationMinutes"
              min={1}
              step={1}
              defaultValue={project.target_duration_minutes ?? ""}
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              BPM mínimo
            </span>
            <input
              type="number"
              name="bpmMin"
              min={40}
              max={250}
              step={0.01}
              defaultValue={project.bpm_min ?? ""}
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              BPM máximo
            </span>
            <input
              type="number"
              name="bpmMax"
              min={40}
              max={250}
              step={0.01}
              defaultValue={project.bpm_max ?? ""}
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-claude-text-muted">
            Direção narrativa
          </span>
          <textarea
            name="narrativeBrief"
            rows={5}
            defaultValue={project.narrative_brief ?? ""}
            placeholder="Ex.: abertura hipnótica, subida gradual de tensão, pico emocional no terço final e fechamento quente."
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
            {isPending ? "Salvando..." : "Salvar alterações"}
          </button>

          <p className="text-sm text-claude-text-faint">
            As mudanças são gravadas diretamente no projeto atual.
          </p>
        </div>
      </form>
    </section>
  );
}