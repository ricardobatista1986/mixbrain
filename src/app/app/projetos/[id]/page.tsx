import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { EditProjectForm } from "@/components/edit-project-form";
import { AddCandidateForm } from "@/components/add-candidate-form";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
  }).format(new Date(date));
}

function formatBpm(value: number | null) {
  if (value === null) return "—";
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
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

  const { data: candidates, error: candidatesError } = await supabase
    .from("set_candidates")
    .select(
      "id, status, notes, created_at, tracks ( id, title, artist, bpm, musical_key, energy, mood )",
    )
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  const { data: allTracks, error: tracksError } = await supabase
    .from("tracks")
    .select("id, title, artist, bpm, musical_key, energy, mood")
    .order("title", { ascending: true });

  if (tracksError) {
    throw new Error(tracksError.message);
  }

  const candidateTrackIds = new Set(
    candidates?.map((c) => {
      const track = Array.isArray(c.tracks) ? c.tracks[0] : c.tracks;
      return track?.id;
    }) ?? [],
  );
  const availableTracks =
    allTracks?.filter((t) => !candidateTrackIds.has(t.id)) ?? [];

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

        <div className="mt-10 grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <EditProjectForm project={project} />

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                01
              </p>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-100">
                Direção narrativa
              </h2>
              <p className="mt-3 leading-7 text-slate-400">
                {project.narrative_brief?.trim()
                  ? project.narrative_brief
                  : "Ainda não definida. Use o formulário ao lado para registrar o arco, energia, momentos e intenção do set."}
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                02
              </p>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-100">
                Candidatas
              </h2>
              <p className="mt-3 leading-7 text-slate-400">
                {candidates && candidates.length > 0
                  ? `${candidates.length} track(s) já adicionada(s) como candidata(s). Veja a lista completa abaixo.`
                  : "Nenhuma candidata adicionada ainda. Use o seletor abaixo para escolher a primeira track da biblioteca."}
              </p>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                03
              </p>
              <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-100">
                Versões e blocos
              </h2>
              <p className="mt-3 leading-7 text-slate-400">
                Salve versões de set e preserve trechos de sequência já
                aprovados como blocos congelados.
              </p>
            </section>
          </div>
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
          <AddCandidateForm
            projectId={project.id}
            availableTracks={availableTracks}
          />

          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Lista de candidatas
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-50">
                  {candidates?.length ?? 0} tracks selecionadas
                </h2>
              </div>
            </div>

            {candidates && candidates.length > 0 ? (
              <div className="mt-6 space-y-4">
                {candidates.map((candidate) => {
                  const track = Array.isArray(candidate.tracks)
                    ? candidate.tracks[0]
                    : candidate.tracks;

                  if (!track) return null;

                  return (
                    <article
                      key={candidate.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/70 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold tracking-tight text-slate-100">
                            {track.title}
                          </h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {track.artist}
                          </p>
                        </div>

                        <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                          {track.energy ? `Energia ${track.energy}/10` : "Sem energia"}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            BPM
                          </p>
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
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Mood
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-200">
                            {track.mood?.trim() ? track.mood : "—"}
                          </p>
                        </div>
                      </div>

                      {candidate.notes?.trim() ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Observações
                          </p>
                          <p className="mt-2 text-sm text-slate-300">
                            {candidate.notes}
                          </p>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6">
                <p className="text-sm leading-7 text-slate-400">
                  Nenhuma candidata adicionada ainda. Use o seletor ao lado para
                  escolher tracks da sua biblioteca.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}