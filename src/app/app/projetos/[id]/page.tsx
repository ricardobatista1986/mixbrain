import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import {
  addCandidate,
  approveCandidateToTracklist,
  moveTracklistItemDown,
  moveTracklistItemUp,
  removeFromTracklist,
} from "./actions";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({
  params,
}: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims?.sub) {
    redirect("/login");
  }

  const userId = claims.sub;

  const { data: project, error: projectError } = await supabase
    .from("set_projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (projectError || !project) {
    redirect("/app");
  }

  // BUSCA TODAS AS TRACKS PARA O DROPDOWN
  const { data: allTracks } = await supabase
    .from("tracks")
    .select("id, title, artist")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const { data: candidates, error: candidatesError } = await supabase
    .from("set_candidates")
    .select(`
      id,
      track_id,
      notes,
      tracks (
        id,
        title,
        artist,
        bpm,
        musical_key,
        energy,
        mood,
        source,
        notes
      )
    `)
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  const { data: tracklistItems, error: tracklistError } = await supabase
    .from("set_tracklist_items")
    .select(`
      id,
      position,
      track_id,
      tracks (
        id,
        title,
        artist,
        bpm,
        musical_key,
        energy,
        mood,
        source,
        notes
      )
    `)
    .eq("project_id", id)
    .order("position", { ascending: true });

  if (tracklistError) {
    throw new Error(tracklistError.message);
  }

  const tracklistTrackIds = new Set(
    (tracklistItems ?? []).map((item) => item.track_id)
  );
  const candidateTrackIds = new Set(
    (candidates ?? []).map((c) => c.track_id)
  );

  const pendingCandidates =
    candidates?.filter((candidate) => !tracklistTrackIds.has(candidate.track_id)) ??
    [];
    
  // Tracks que ainda não foram adicionadas como candidatas
  const availableTracks =
    allTracks?.filter((t) => !candidateTrackIds.has(t.id)) ?? [];

  const addCandidateAction = addCandidate.bind(null, id);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10 lg:px-12">
          <Link
            href="/app"
            className="flex items-center gap-3 transition hover:opacity-80"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950">
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MixBrain</p>
              <p className="text-xs text-slate-400">Projeto de set</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
            >
              Workspace
            </Link>
            <Link
              href="/app/glossario"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
            >
              Glossário
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_40%)]">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-10 lg:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Projeto
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            {project.name}
          </h1>
          {project.description ? (
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              {project.description}
            </p>
          ) : (
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-400">
              Este projeto ainda não tem descrição.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  Candidatas
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Tracks disponíveis para aprovação
                </h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300">
                {pendingCandidates.length}
              </span>
            </div>

            {/* FORMULÁRIO RECUPERADO PARA ADICIONAR TRACK DA BIBLIOTECA */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/40 p-5">
              <h3 className="mb-3 text-sm font-bold text-slate-300">
                Adicionar track da biblioteca
              </h3>
              <form action={addCandidateAction} className="flex flex-col gap-3">
                <select
                  name="trackId"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-cyan-300/50"
                  required
                >
                  <option value="">Selecione uma track...</option>
                  {availableTracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} {t.artist ? `- ${t.artist}` : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="notes"
                  placeholder="Nota ou intenção para este set (opcional)..."
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-cyan-300/50"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
                >
                  Adicionar como Candidata
                </button>
              </form>
            </div>

            <div className="mt-6 space-y-4">
              {pendingCandidates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-400">
                  Sem candidatas na fila de aprovação.
                </div>
              ) : (
                pendingCandidates.map((candidate) => {
                  const track = Array.isArray(candidate.tracks)
                    ? candidate.tracks[0]
                    : candidate.tracks;

                  if (!track) return null;

                  return (
                    <article
                      key={candidate.id}
                      className="rounded-2xl border border-white/10 bg-slate-900/50 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold">{track.title}</h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {track.artist || "Artista não informado"}
                          </p>
                        </div>

                        <form action={approveCandidateToTracklist}>
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="track_id" value={track.id} />
                          <button
                            type="submit"
                            className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:opacity-90"
                          >
                            Aprovar
                          </button>
                        </form>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-white/10 px-3 py-1">
                          BPM: {track.bpm ?? "—"}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1">
                          Key: {track.musical_key ?? "—"}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1">
                          Energia: {track.energy ?? "—"}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1">
                          Mood: {track.mood ?? "—"}
                        </span>
                      </div>

                      {candidate.notes ? (
                        <p className="mt-4 text-sm leading-6 text-slate-400">
                          Nota da candidatura: {candidate.notes}
                        </p>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
                  Tracklist
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Sequência atual do set
                </h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300">
                {tracklistItems?.length ?? 0}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {!tracklistItems || tracklistItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-6 text-slate-400">
                  Nenhuma track aprovada ainda. Use o botão “Aprovar” nas candidatas.
                </div>
              ) : (
                tracklistItems.map((item, index) => {
                  const track = Array.isArray(item.tracks)
                    ? item.tracks[0]
                    : item.tracks;

                  if (!track) return null;

                  const isFirst = index === 0;
                  const isLast = index === tracklistItems.length - 1;

                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-950/70 text-sm font-black text-cyan-200">
                            {item.position}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold">{track.title}</h3>
                            <p className="mt-1 text-sm text-slate-300">
                              {track.artist || "Artista não informado"}
                            </p>
                          </div>
                        </div>

                        <form action={removeFromTracklist}>
                          <input type="hidden" name="project_id" value={id} />
                          <input
                            type="hidden"
                            name="tracklist_item_id"
                            value={item.id}
                          />
                          <button
                            type="submit"
                            className="rounded-full border border-rose-300/30 px-4 py-2 text-sm font-medium text-rose-200 transition hover:border-rose-300/60"
                          >
                            Remover
                          </button>
                        </form>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-200">
                        <span className="rounded-full border border-white/10 px-3 py-1">
                          BPM: {track.bpm ?? "—"}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1">
                          Key: {track.musical_key ?? "—"}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1">
                          Energia: {track.energy ?? "—"}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1">
                          Mood: {track.mood ?? "—"}
                        </span>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <form action={moveTracklistItemUp}>
                          <input type="hidden" name="project_id" value={id} />
                          <input
                            type="hidden"
                            name="tracklist_item_id"
                            value={item.id}
                          />
                          <button
                            type="submit"
                            disabled={isFirst}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Subir
                          </button>
                        </form>

                        <form action={moveTracklistItemDown}>
                          <input type="hidden" name="project_id" value={id} />
                          <input
                            type="hidden"
                            name="tracklist_item_id"
                            value={item.id}
                          />
                          <button
                            type="submit"
                            disabled={isLast}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Descer
                          </button>
                        </form>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}