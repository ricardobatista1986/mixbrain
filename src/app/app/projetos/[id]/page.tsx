import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import {
  addCandidate,
  approveCandidateToTracklist,
  createFrozenBlock,
  dissolveFrozenBlock,
  moveEntityDown,
  moveEntityUp,
  removeFromTracklist,
} from "./actions";
import {
  calculateTransitionScore,
  type ScoreTrack,
  type TransitionScore,
} from "@/lib/mixbrain/transition-score";

type ProjectPageProps = {
  params: Promise<{ id: string }>;
};

type Track = {
  id: string;
  title: string;
  artist: string | null;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
};

type BlockRef = {
  name: string;
};

type TracklistItem = {
  id: string;
  position: number;
  track_id: string;
  block_id: string | null;
  tracks: Track | Track[] | null;
  set_blocks?: BlockRef | BlockRef[] | null;
};

type GroupedBlock = {
  isBlock: true;
  block_id: string;
  block_name: string;
  items: TracklistItem[];
};

type GroupedSingle = {
  isBlock: false;
  item: TracklistItem;
};

type GroupedItem = GroupedBlock | GroupedSingle;

function getTrackFromRelation(
  relation: ScoreTrack | ScoreTrack[] | null | undefined
): ScoreTrack | null {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
}

function getScoreToneClasses(score: TransitionScore) {
  const tones = {
    emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    cyan: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
    amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    rose: "border-rose-300/30 bg-rose-300/10 text-rose-100",
    slate: "border-white/10 bg-white/[0.03] text-slate-200",
  };

  return tones[score.tone];
}

function getFactorStatusLabel(status: "available" | "missing" | "pending") {
  if (status === "available") {
    return "Calculado";
  }

  if (status === "missing") {
    return "Dado ausente";
  }

  return "Aguardando contexto";
}

function TransitionScoreCard({
  score,
}: {
  score: TransitionScore | null;
}) {
  if (!score) {
    return null;
  }

  return (
    <details
      className={`rounded-xl border p-3 ${getScoreToneClasses(score)}`}
    >
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">
              Score MixBrain:{" "}
              {score.finalScore === null ? "—" : `${score.finalScore}%`}
            </p>
            <p className="mt-1 text-xs opacity-80">
              Para a transição até a próxima track.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-current/20 px-3 py-1 text-xs font-bold">
              {score.label}
            </span>
            <span className="rounded-full border border-current/20 px-3 py-1 text-xs">
              Confiança: {score.confidence}%
            </span>
            <span className="text-xs font-bold">Ver fatores</span>
          </div>
        </div>
      </summary>

      <div className="mt-4 border-t border-current/20 pt-4">
        <p className="text-xs leading-5 opacity-80">
          O score usa somente fatores com dados disponíveis. Narrativa e momento
          ainda aguardam marcação curatorial do projeto.
        </p>

        <div className="mt-4 space-y-2">
          {score.factors.map((factor) => (
            <div
              key={factor.id}
              className="rounded-lg border border-current/15 bg-slate-950/20 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{factor.title}</span>
                  <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-medium">
                    Peso oficial: {factor.officialWeight}%
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full border border-current/20 px-2 py-0.5">
                    {getFactorStatusLabel(factor.status)}
                  </span>
                  {factor.score !== null ? (
                    <span className="font-black">{factor.score}%</span>
                  ) : null}
                </div>
              </div>

              <p className="mt-2 text-xs leading-5 opacity-85">
                {factor.explanation}
              </p>
            </div>
          ))}
        </div>

        <Link
          href="/app/glossario"
          className="mt-4 inline-flex text-xs font-bold underline underline-offset-4 transition hover:opacity-75"
        >
          Entender pesos e regras no glossário
        </Link>
      </div>
    </details>
  );
}

export default async function ProjectDetailPage({
  params,
}: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();

  if (!authData?.claims?.sub) {
    redirect("/login");
  }

  const userId = authData.claims.sub;

  const { data: project } = await supabase
    .from("set_projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!project) {
    redirect("/app");
  }

  const { data: allTracks } = await supabase
    .from("tracks")
    .select("id, title, artist")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const { data: candidates } = await supabase
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

  const { data: rawTracklistItems } = await supabase
    .from("set_tracklist_items")
    .select(`
      id,
      position,
      track_id,
      block_id,
      set_blocks ( name ),
      tracks (
        id,
        title,
        artist,
        bpm,
        musical_key,
        energy,
        mood
      )
    `)
    .eq("project_id", id)
    .order("position", { ascending: true });

  const tracklistItems = (rawTracklistItems ?? []) as TracklistItem[];

  const tracklistTrackIds = new Set(
    tracklistItems.map((item) => item.track_id)
  );

  const candidateTrackIds = new Set(
    (candidates ?? []).map((candidate) => candidate.track_id)
  );

  const pendingCandidates =
    candidates?.filter(
      (candidate) => !tracklistTrackIds.has(candidate.track_id)
    ) ?? [];

  const availableTracks =
    allTracks?.filter((track) => !candidateTrackIds.has(track.id)) ?? [];

  const addCandidateAction = addCandidate.bind(null, id);

  const groupedItems: GroupedItem[] = [];
  let currentBlock: GroupedBlock | null = null;

  for (const item of tracklistItems) {
    if (item.block_id) {
      if (!currentBlock || currentBlock.block_id !== item.block_id) {
        currentBlock = {
          isBlock: true,
          block_id: item.block_id,
          block_name: Array.isArray(item.set_blocks)
            ? item.set_blocks[0]?.name || "Bloco"
            : item.set_blocks?.name || "Bloco",
          items: [item],
        };

        groupedItems.push(currentBlock);
      } else {
        currentBlock.items.push(item);
      }
    } else {
      currentBlock = null;
      groupedItems.push({
        isBlock: false,
        item,
      });
    }
  }

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
                  Tracks disponíveis
                </h2>
              </div>

              <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300">
                {pendingCandidates.length}
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/40 p-5">
              <h3 className="mb-3 text-sm font-bold text-slate-300">
                Adicionar da biblioteca
              </h3>

              <form action={addCandidateAction} className="flex flex-col gap-3">
                <select
                  name="trackId"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-100 outline-none"
                  required
                >
                  <option value="">Selecione uma track...</option>

                  {availableTracks.map((track) => (
                    <option key={track.id} value={track.id}>
                      {track.title} {track.artist ? `- ${track.artist}` : ""}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  name="notes"
                  placeholder="Nota ou intenção..."
                  className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-100 outline-none"
                />

                <button
                  type="submit"
                  className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
                >
                  Adicionar Candidata
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

                  if (!track) {
                    return null;
                  }

                  return (
                    <article
                      key={candidate.id}
                      className="rounded-2xl border border-white/10 bg-slate-900/50 p-5"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold">{track.title}</h3>
                          <p className="text-sm text-slate-400">
                            {track.artist || "Artista não informado"}
                          </p>
                        </div>

                        <form action={approveCandidateToTracklist}>
                          <input type="hidden" name="project_id" value={id} />
                          <input type="hidden" name="track_id" value={track.id} />

                          <button
                            type="submit"
                            className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:opacity-90"
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
                  Sequência e Blocos
                </h2>
              </div>
            </div>

            <form id="create-block-form" action={createFrozenBlock}>
              <input type="hidden" name="project_id" value={id} />
            </form>

            <div className="mt-6 flex items-center justify-between rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <input
                form="create-block-form"
                type="text"
                name="block_name"
                placeholder="Nome do bloco..."
                className="w-1/2 bg-transparent text-sm text-white outline-none"
                required
              />

              <button
                form="create-block-form"
                type="submit"
                className="rounded-full bg-indigo-500/20 px-4 py-1.5 text-sm font-bold text-indigo-300 transition hover:bg-indigo-500/30"
              >
                Congelar Selecionadas
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {groupedItems.length === 0 ? (
                <div className="p-6 text-slate-400">
                  Nenhuma track aprovada.
                </div>
              ) : (
                groupedItems.map((group, index) => {
                  const isFirst = index === 0;
                  const isLast = index === groupedItems.length - 1;

                  if (group.isBlock) {
                    return (
                      <div
                        key={`block-${group.block_id}`}
                        className="rounded-2xl border-2 border-indigo-500/30 bg-indigo-500/[0.03] p-2 sm:p-4"
                      >
                        <div className="mb-4 flex items-center justify-between px-2">
                          <div className="flex items-center gap-3">
                            <span className="font-bold tracking-tight text-indigo-400">
                              ❄️ {group.block_name}
                            </span>

                            <span className="text-xs text-indigo-400/50">
                              {group.items.length} tracks
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <form action={moveEntityUp}>
                              <input
                                type="hidden"
                                name="project_id"
                                value={id}
                              />
                              <input
                                type="hidden"
                                name="entity_id"
                                value={group.block_id}
                              />
                              <input
                                type="hidden"
                                name="is_block"
                                value="true"
                              />

                              <button
                                type="submit"
                                disabled={isFirst}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                ⬆️
                              </button>
                            </form>

                            <form action={moveEntityDown}>
                              <input
                                type="hidden"
                                name="project_id"
                                value={id}
                              />
                              <input
                                type="hidden"
                                name="entity_id"
                                value={group.block_id}
                              />
                              <input
                                type="hidden"
                                name="is_block"
                                value="true"
                              />

                              <button
                                type="submit"
                                disabled={isLast}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                ⬇️
                              </button>
                            </form>

                            <form action={dissolveFrozenBlock}>
                              <input
                                type="hidden"
                                name="project_id"
                                value={id}
                              />
                              <input
                                type="hidden"
                                name="block_id"
                                value={group.block_id}
                              />

                              <button
                                type="submit"
                                className="ml-2 p-1 text-rose-400 hover:text-rose-300"
                              >
                                Desfazer
                              </button>
                            </form>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {group.items.map((item, itemIndex) => {
                            const track = getTrackFromRelation(item.tracks);

                            if (!track) {
                              return null;
                            }

                            const nextItem = group.items[itemIndex + 1];
                            const nextTrack = nextItem
                              ? getTrackFromRelation(nextItem.tracks)
                              : null;

                            const transitionScore = calculateTransitionScore(
                              track,
                              nextTrack
                            );

                            return (
                              <div key={item.id} className="space-y-2">
                                <article className="flex gap-4 rounded-xl border border-white/5 bg-slate-900/50 p-4">
                                  <div className="w-6 text-sm font-bold text-slate-500">
                                    {item.position}
                                  </div>

                                  <div className="flex-1">
                                    <p className="font-bold text-slate-200">
                                      {track.title}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {track.artist || "Artista não informado"}
                                    </p>

                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
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
                                  </div>
                                </article>

                                <TransitionScoreCard score={transitionScore} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  const track = getTrackFromRelation(group.item.tracks);

                  if (!track) {
                    return null;
                  }

                  const nextGroup = groupedItems[index + 1];
                  let nextTrack: ScoreTrack | null = null;

                  if (nextGroup?.isBlock) {
                    nextTrack = getTrackFromRelation(
                      nextGroup.items[0].tracks
                    );
                  } else if (nextGroup && !nextGroup.isBlock) {
                    nextTrack = getTrackFromRelation(nextGroup.item.tracks);
                  }

                  const transitionScore = calculateTransitionScore(
                    track,
                    nextTrack
                  );

                  return (
                    <div key={group.item.id} className="space-y-2">
                      <article className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.03] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <input
                              form="create-block-form"
                              type="checkbox"
                              name="selected_items"
                              value={group.item.id}
                              className="h-5 w-5 rounded border-white/20 bg-slate-900"
                            />

                            <div className="w-6 text-sm font-bold text-cyan-500">
                              {group.item.position}
                            </div>

                            <div>
                              <h3 className="font-bold">{track.title}</h3>
                              <p className="text-xs text-slate-400">
                                {track.artist || "Artista não informado"}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
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
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                              <form action={moveEntityUp}>
                                <input
                                  type="hidden"
                                  name="project_id"
                                  value={id}
                                />
                                <input
                                  type="hidden"
                                  name="entity_id"
                                  value={group.item.id}
                                />
                                <input
                                  type="hidden"
                                  name="is_block"
                                  value="false"
                                />

                                <button
                                  type="submit"
                                  disabled={isFirst}
                                  className="text-slate-400 hover:text-white disabled:opacity-30"
                                >
                                  ⬆️
                                </button>
                              </form>

                              <form action={moveEntityDown}>
                                <input
                                  type="hidden"
                                  name="project_id"
                                  value={id}
                                />
                                <input
                                  type="hidden"
                                  name="entity_id"
                                  value={group.item.id}
                                />
                                <input
                                  type="hidden"
                                  name="is_block"
                                  value="false"
                                />

                                <button
                                  type="submit"
                                  disabled={isLast}
                                  className="text-slate-400 hover:text-white disabled:opacity-30"
                                >
                                  ⬇️
                                </button>
                              </form>
                            </div>

                            <form
                              action={removeFromTracklist}
                              className="text-right"
                            >
                              <input
                                type="hidden"
                                name="project_id"
                                value={id}
                              />
                              <input
                                type="hidden"
                                name="tracklist_item_id"
                                value={group.item.id}
                              />

                              <button
                                type="submit"
                                className="text-xs text-rose-400 hover:text-rose-300"
                              >
                                Remover
                              </button>
                            </form>
                          </div>
                        </div>
                      </article>

                      <TransitionScoreCard score={transitionScore} />
                    </div>
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