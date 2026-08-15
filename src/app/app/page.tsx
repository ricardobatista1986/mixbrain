import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { CreateProjectForm } from "@/components/create-project-form";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { ProjectCardActions } from "@/components/project-card-actions";
import { createClient } from "@/lib/supabase/server";

export default async function AppPage() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims) {
    redirect("/login");
  }

  const { data: projects, error } = await supabase
    .from("set_projects")
    .select("id, name, description, target_duration_minutes, created_at, archived_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const activeProjects = (projects ?? []).filter((project) => !project.archived_at);
  const archivedProjects = (projects ?? []).filter((project) => project.archived_at);

  return (
    <main className="min-h-screen bg-claude-bg px-6 py-10 text-claude-text sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-claude-border pb-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-claude-accent font-black text-claude-bg">
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MixBrain</p>
              <p className="text-xs text-claude-text-muted">Workspace privado</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app/tracks"
              className="rounded-full border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted transition hover:border-claude-accent/50 hover:text-claude-accent-hover"
            >
              Biblioteca
            </Link>
            <Link
              href="/app/importar-csv"
              className="rounded-full border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted transition hover:border-claude-accent/50 hover:text-claude-accent-hover"
            >
              Importar CSV
            </Link>
            <Link
              href="/app/glossario"
              className="rounded-full border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted transition hover:border-claude-accent/50 hover:text-claude-accent-hover"
            >
              Glossário
            </Link>
            <LogoutButton />
          </div>
        </header>

        <section className="mt-10 rounded-3xl border border-claude-accent/20 bg-gradient-to-br from-claude-accent/10 via-claude-surface to-violet-500/10 p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent-hover">
            Projetos de set
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight">
            Seu workspace agora conversa com o banco real.
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-claude-text-muted">
            Crie projetos, organize a intenção narrativa de cada set e use esta
            base como ponto de partida para biblioteca, candidatas, blocos,
            versões e importação em lote da sua coleção.
          </p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Link
            href="/app/tracks"
            className="rounded-3xl border border-claude-border bg-claude-surface p-6 transition hover:border-claude-accent/40 hover:bg-claude-accent/[0.04]"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
              Biblioteca
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Ver tracks
            </h2>
            <p className="mt-3 text-sm leading-6 text-claude-text-muted">
              Acesse sua biblioteca já cadastrada e use as tracks nos projetos.
            </p>
          </Link>

          <Link
            href="/app/importar-csv"
            className="rounded-3xl border border-claude-border bg-claude-surface p-6 transition hover:border-claude-accent/40 hover:bg-claude-accent/[0.04]"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
              Biblioteca
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Importar CSV
            </h2>
            <p className="mt-3 text-sm leading-6 text-claude-text-muted">
              Carregue várias tracks com BPM, key, energia, mood e notas em lote.
            </p>
          </Link>

          <Link
            href="/app/glossario"
            className="rounded-3xl border border-claude-border bg-claude-surface p-6 transition hover:border-claude-accent/40 hover:bg-claude-accent/[0.04]"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
              MixBrain
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Abrir glossário
            </h2>
            <p className="mt-3 text-sm leading-6 text-claude-text-muted">
              Consulte pesos, lógica de score e definições curatoriais do sistema.
            </p>
          </Link>
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <CreateProjectForm />

          <section className="rounded-3xl border border-claude-border bg-claude-surface/70 p-6 shadow-2xl shadow-claude-bg/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-claude-accent">
                  Projetos salvos
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-claude-text">
                  Seus projetos
                </h2>
              </div>

              <div className="rounded-full border border-claude-border px-3 py-1 text-sm text-claude-text-muted">
                {activeProjects.length} projeto(s)
              </div>
            </div>

            {activeProjects.length > 0 ? (
              <div className="mt-8 space-y-4">
                {activeProjects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-2xl border border-claude-border bg-claude-surface/70 p-5 transition hover:border-claude-accent/40"
                  >
                    <Link
                      href={`/app/projetos/${project.id}`}
                      className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-claude-accent/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold tracking-tight text-claude-text">
                            {project.name}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-claude-text-muted">
                            {project.description?.trim()
                              ? project.description
                              : "Sem descrição ainda."}
                          </p>
                        </div>

                        <div className="rounded-full border border-claude-accent/20 bg-claude-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-claude-accent-hover">
                          {project.target_duration_minutes
                            ? `${project.target_duration_minutes} min`
                            : "Sem duração"}
                        </div>
                      </div>

                      <p className="mt-5 text-sm font-semibold text-claude-accent-hover">
                        Abrir projeto <span aria-hidden="true">→</span>
                      </p>
                    </Link>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-claude-border/60 pt-4">
                      <ProjectCardActions projectId={project.id} archived={false} />
                      <DeleteProjectButton
                        projectId={project.id}
                        projectName={project.name}
                        variant="icon"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-2xl border border-dashed border-claude-border bg-claude-surface/50 p-6 text-sm leading-7 text-claude-text-muted">
                Nenhum projeto criado ainda. Use o formulário ao lado para criar
                o primeiro projeto do MixBrain.
              </div>
            )}

            {archivedProjects.length > 0 ? (
              <details className="mt-8 rounded-2xl border border-claude-border bg-claude-surface/40">
                <summary className="cursor-pointer list-none px-5 py-3 text-sm font-bold text-claude-text-muted transition hover:text-claude-text">
                  Arquivados ({archivedProjects.length})
                </summary>
                <div className="space-y-3 border-t border-claude-border p-5">
                  {archivedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="rounded-xl border border-claude-border bg-claude-surface/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Link
                          href={`/app/projetos/${project.id}`}
                          className="text-sm font-semibold text-claude-text-muted hover:text-claude-accent-hover"
                        >
                          {project.name}
                        </Link>
                        <div className="flex items-center gap-2">
                          <ProjectCardActions projectId={project.id} archived />
                          <DeleteProjectButton
                            projectId={project.id}
                            projectName={project.name}
                            variant="icon"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}