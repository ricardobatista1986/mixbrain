import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(new Date(date));
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims) {
    redirect("/login");
  }

  const { data: project, error } = await supabase
    .from("set_projects")
    .select(
      "id, name, description, target_duration_minutes, bpm_min, bpm_max, narrative_brief, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!project) {
    notFound();
  }

  const bpmRange =
    project.bpm_min && project.bpm_max
      ? `${project.bpm_min}–${project.bpm_max} BPM`
      : project.bpm_min
        ? `A partir de ${project.bpm_min} BPM`
        : project.bpm_max
          ? `Até ${project.bpm_max} BPM`
          : "Ainda não definido";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950">
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MixBrain</p>
              <p className="text-xs text-slate-400">Workspace privado</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
            >
              Voltar aos projetos
            </Link>
            <LogoutButton />
          </div>
        </header>

        <nav className="mt-8 text-sm text-slate-400" aria-label="Navegação">
          <Link href="/app" className="transition hover:text-cyan-200">
            Projetos
          </Link>
          <span className="mx-2 text-slate-600">/</span>
          <span className="text-slate-200">{project.name}</span>
        </nav>

        <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 via-slate-900 to-violet-500/10 p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Projeto de set
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight">
            {project.name}
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            {project.description?.trim()
              ? project.description
              : "Este projeto ainda não tem uma descrição. Defina sua direção narrativa antes de selecionar as tracks."}
          </p>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Duração alvo
            </p>
            <p className="mt-3 text-xl font-black tracking-tight text-slate-100">
              {project.target_duration_minutes
                ? `${project.target_duration_minutes} min`
                : "Não definida"}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Faixa de BPM
            </p>
            <p className="mt-3 text-xl font-black tracking-tight text-slate-100">
              {bpmRange}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Criado em
            </p>
            <p className="mt-3 text-xl font-black tracking-tight text-slate-100">
              {formatDate(project.created_at)}
            </p>
          </article>

          <article className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Atualizado em
            </p>
            <p className="mt-3 text-xl font-black tracking-tight text-slate-100">
              {formatDate(project.updated_at)}
            </p>
          </article>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              01
            </p>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-100">
              Direção narrativa
            </h2>
            <p className="mt-3 leading-7 text-slate-400">
              {project.narrative_brief?.trim()
                ? project.narrative_brief
                : "Ainda não definida. A próxima evolução permitirá registrar o arco, energia, momentos e intenção do set."}
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              02
            </p>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-100">
              Candidatas
            </h2>
            <p className="mt-3 leading-7 text-slate-400">
              Nenhuma track adicionada ainda. Esta área receberá a seleção de
              candidatas da sua biblioteca.
            </p>
          </article>

          <article className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
              03
            </p>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-100">
              Versões e blocos
            </h2>
            <p className="mt-3 leading-7 text-slate-400">
              Salve versões de set e preserve trechos de sequência já aprovados
              como blocos congelados.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}