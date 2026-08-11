import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { CreateProjectForm } from "@/components/create-project-form";
import { DeleteProjectButton } from "@/components/delete-project-button";
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
    .select("id, name, description, target_duration_minutes, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

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
              href="/app/tracks"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
            >
              Biblioteca
            </Link>
            <Link
              href="/app/importar-csv"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
            >
              Importar CSV
            </Link>
            <Link
              href="/app/glossario"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
            >
              Glossário
            </Link>
            <LogoutButton />
          </div>
        </header>

        <section className="mt-10 rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 via-slate-900 to-violet-500/10 p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Projetos de set
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight">
            Seu workspace agora conversa com o banco real.
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Crie projetos, organize a intenção narrativa de cada set e use esta
            base como ponto de partida para biblioteca, candidatas, blocos,
            versões e importação em lote da sua coleção.
          </p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Link
            href="/app/tracks"
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.04]"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Biblioteca
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Ver tracks
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Acesse sua biblioteca já cadastrada e use as tracks nos projetos.
            </p>
          </Link>

          <Link
            href="/app/importar-csv"
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.04]"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Biblioteca
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Importar CSV
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Carregue várias tracks com BPM, key, energia, mood e notas em lote.
            </p>
          </Link>

          <Link
            href="/app/glossario"
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.04]"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              MixBrain
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">
              Abrir glossário
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Consulte pesos, lógica de score e definições curatoriais do sistema.
            </p>
          </Link>
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <CreateProjectForm />

          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Projetos salvos
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-50">
                  Seus projetos
                </h2>
              </div>

              <div className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-400">
                {projects?.length ?? 0} projeto(s)
              </div>
            </div>

            {projects && projects.length > 0 ? (
              <div className="mt-8 space-y-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 transition hover:border-cyan-300/40"
                  >
                    <Link
                      href={`/app/projetos/${project.id}`}
                      className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold tracking-tight text-slate-100">
                            {project.name}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {project.description?.trim()
                              ? project.description
                              : "Sem descrição ainda."}
                          </p>
                        </div>

                        <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                          {project.target_duration_minutes
                            ? `${project.target_duration_minutes} min`
                            : "Sem duração"}
                        </div>
                      </div>

                      <p className="mt-5 text-sm font-semibold text-cyan-200">
                        Abrir projeto <span aria-hidden="true">→</span>
                      </p>
                    </Link>

                    <div className="mt-4 flex justify-end border-t border-white/5 pt-4">
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
              <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-sm leading-7 text-slate-400">
                Nenhum projeto criado ainda. Use o formulário ao lado para criar
                o primeiro projeto do MixBrain.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}