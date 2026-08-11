import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { EditProjectForm } from "@/components/edit-project-form";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { AddCandidateForm } from "@/components/add-candidate-form";
import { createClient } from "@/lib/supabase/server";
import {
  approveCandidateToTracklist,
  createFrozenBlock,
  dissolveFrozenBlock,
  moveEntityDown,
  moveEntityUp,
  removeFromTracklist,
  updateCuratorialFields,
} from "./actions";
import {
  calculateTransitionScore,
  type CuratorialMoment,
  type ScoreTrack,
  type ScoreTracklistItemContext,
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
  curatorial_moment: CuratorialMoment | null;
  curatorial_intent: string | null;
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
  if (status === "available") return "Calculado";
  if (status === "missing") return "Dado ausente";
  return "Aguardando contexto";
}

function getMomentLabel(moment: CuratorialMoment | null) {
  const labels: Record<CuratorialMoment, string> = {
    opening: "Abertura",
    build: "Construção",
    valley: "Vale",
    peak: "Pico",
    contemplation: "Contemplação",
    closing: "Encerramento",
  };
  if (!moment) return "Sem momento";
  return labels[moment];
}

function getContextFromItem(
  item: TracklistItem | null | undefined
): ScoreTracklistItemContext | null {
  if (!item) return null;
  return {
    curatorial_moment: item.curatorial_moment,
  };
}

function MixBrainLegend() {
  return (
    <details className="group mb-8 overflow-hidden rounded-3xl border border-indigo-500/30 bg-indigo-500/[0.03]">
      <summary className="flex cursor-pointer items-center justify-between p-6 font-black tracking-tight text-indigo-100 transition hover:bg-indigo-500/[0.05]">
        <div className="flex items-center gap-3">
          <span className="text-xl">🧠</span>
          <span className="text-lg">Como o MixBrain avalia seu set? (Glossário Rápido)</span>
        </div>
        <span className="text-indigo-400 transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>

      <div className="border-t border-indigo-500/20 p-6 sm:p-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Rótulos */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-300">
              Os Rótulos
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-100">
                  EXCELENTE
                </span>
                <span className="text-slate-300">
                  85% a 100%. Transição perfeita e sem atrito.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-bold text-cyan-100">
                  BOA
                </span>
                <span className="text-slate-300">
                  70% a 84%. Mixável e funcional narrativamente.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold text-amber-100">
                  ATENÇÃO
                </span>
                <span className="text-slate-300">
                  55% a 69%. Exige técnica, ponte ou pausa de respiro.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full border border-rose-300/30 bg-rose-300/10 px-2 py-0.5 text-[10px] font-bold text-rose-100">
                  FRACA
                </span>
                <span className="text-slate-300">
                  Abaixo de 55%. Alto risco de choque de energia ou harmonia.
                </span>
              </li>
            </ul>
          </div>

          {/* Momentos Curatoriais */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-300">
              Momentos Curatoriais
            </h4>
            <ul className="space-y-2 text-sm text-slate-300">
              <li>
                <strong className="text-slate-100">Abertura:</strong> Introdução do set, clima inicial.
              </li>
              <li>
                <strong className="text-slate-100">Construção:</strong> Elevando a energia, preparando o terreno.
              </li>
              <li>
                <strong className="text-slate-100">Vale:</strong> Respiro, quebra de expectativa ou tensão pré-pico.
              </li>
              <li>
                <strong className="text-slate-100">Pico:</strong> Clímax, catarse, maior entrega de energia.
              </li>
              <li>
                <strong className="text-slate-100">Contemplação:</strong> Densidade emocional, viagem sonora reflexiva.
              </li>
              <li>
                <strong className="text-slate-100">Encerramento:</strong> Desfecho e conclusão da narrativa.
              </li>
            </ul>
          </div>

          {/* Os 7 Fatores */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-300">
              Os 7 Fatores (Pesos)
            </h4>
            <ul className="space-y-1.5 text-sm text-slate-300">
              <li>
                <strong className="text-slate-100">Narrativa (28%):</strong> Coerência da jornada.
              </li>
              <li>
                <strong className="text-slate-100">Timing/Momento (22%):</strong> Relação da track com a fase do set.
              </li>
              <li>
                <strong className="text-slate-100">Harmonia (16%):</strong> Transições no círculo de Camelot.
              </li>
              <li>
                <strong className="text-slate-100">Energia (13%):</strong> Controle de choques ou continuidades.
              </li>
              <li>
                <strong className="text-slate-100">Mood (9%):</strong> Texturas compartilhadas.
              </li>
              <li>
                <strong className="text-slate-100">BPM (7%):</strong> Diferença percentual de tempo.
              </li>
              <li>
                <strong className="text-slate-100">Diversidade (5%):</strong> Variação inteligente de artistas.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </details>
  );
}

function TransitionScoreCard({
  score,
}: {
  score: TransitionScore | null;
}) {
  if (!score) return null;

  return (
    <details className={`rounded-xl border p-3 ${getScoreToneClasses(score)}`}>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">
              Score MixBrain: {score.finalScore === null ? "—" : `${score.finalScore}%`}
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
          O score usa somente fatores com dados disponíveis e marcações curatoriais já definidas no projeto.
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
      </div>
    </details>
  );
}

function CuratorialEditor({
  projectId,
  item,
}: {
  projectId: string;
  item: TracklistItem;
}) {
  return (
    <form
      action={updateCuratorialFields}
      className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-3"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="tracklist_item_id" value={item.id} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            Momento no set
          </label>
          <select
            name="curatorial_moment"
            defaultValue={item.curatorial_moment ?? ""}
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            <option value="">Sem definição</option>
            <option value="opening">Abertura</option>
            <option value="build">Construção</option>
            <option value="valley">Vale</option>
            <option value="peak">Pico</option>
            <option value="contemplation">Contemplação</option>
            <option value="closing">Encerramento</option>
          </select>
        </div>

        <div className="shrink-0">
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700 sm:w-auto"
          >
            Salvar momento
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="rounded-full border border-white/10 px-3 py-1">
          Momento atual: {getMomentLabel(item.curatorial_moment)}
        </span>
      </div>
    </form>
  );
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
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
    .select("id, title, artist, bpm, musical_key, energy, mood")
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
      curatorial_moment,
      curatorial_intent,
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

  const tracklistTrackIds = new Set(tracklistItems.map((item) => item.track_id));
  const candidateTrackIds = new Set((candidates ?? []).map((candidate) => candidate.track_id));

  const pendingCandidates =
    candidates?.filter((candidate) => !tracklistTrackIds.has(candidate.track_id)) ?? [];

  const availableTracks =
    allTracks?.filter((track) => !candidateTrackIds.has(track.id)) ?? [];


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

          <details className="group mt-8 max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <summary className="cursor-pointer list-none px-5 py-3 text-sm font-bold text-slate-300 transition hover:text-cyan-200">
              <span className="mr-2 inline-block transition-transform group-open:rotate-90">
                ▶
              </span>
              Editar projeto (nome, descrição, BPM alvo e direção narrativa)
            </summary>
            <div className="border-t border-white/10 p-5">
              <EditProjectForm
                project={{
                  id: project.id,
                  name: project.name,
                  description: project.description,
                  target_duration_minutes: project.target_duration_minutes,
                  bpm_min: project.bpm_min,
                  bpm_max: project.bpm_max,
                  narrative_brief: project.narrative_brief,
                }}
              />

              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-rose-300/80">
                  Zona de risco
                </p>
                <DeleteProjectButton
                  projectId={project.id}
                  projectName={project.name}
                  redirectTo="/app"
                  variant="full"
                />
              </div>
            </div>
          </details>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-12">
        <MixBrainLegend />

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

            <div className="mt-6">
              <AddCandidateForm projectId={id} availableTracks={availableTracks} />
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
                <div className="p-6 text-slate-400">Nenhuma track aprovada.</div>
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
                              <input type="hidden" name="project_id" value={id} />
                              <input type="hidden" name="entity_id" value={group.block_id} />
                              <input type="hidden" name="is_block" value="true" />
                              <button
                                type="submit"
                                disabled={isFirst}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                ⬆️
                              </button>
                            </form>

                            <form action={moveEntityDown}>
                              <input type="hidden" name="project_id" value={id} />
                              <input type="hidden" name="entity_id" value={group.block_id} />
                              <input type="hidden" name="is_block" value="true" />
                              <button
                                type="submit"
                                disabled={isLast}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                ⬇️
                              </button>
                            </form>

                            <form action={dissolveFrozenBlock}>
                              <input type="hidden" name="project_id" value={id} />
                              <input type="hidden" name="block_id" value={group.block_id} />
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
                            if (!track) return null;

                            const nextItem = group.items[itemIndex + 1];
                            const nextTrack = nextItem
                              ? getTrackFromRelation(nextItem.tracks)
                              : null;

                            const transitionScore = calculateTransitionScore(
                              track,
                              nextTrack,
                              getContextFromItem(item),
                              getContextFromItem(nextItem)
                            );

                            return (
                              <div key={item.id} className="space-y-2">
                                <article className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
                                  <div className="flex min-w-0 flex-col gap-4">
                                    <div className="flex min-w-0 items-start gap-4">
                                      <div className="w-6 shrink-0 text-sm font-bold text-slate-500">
                                        {item.position}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <p className="break-words font-bold text-slate-200">
                                          {track.title}
                                        </p>
                                        <p className="break-words text-xs text-slate-400">
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

                                    <CuratorialEditor projectId={id} item={item} />
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
                  if (!track) return null;

                  const nextGroup = groupedItems[index + 1];
                  let nextTrack: ScoreTrack | null = null;
                  let nextContext: ScoreTracklistItemContext | null = null;

                  if (nextGroup?.isBlock) {
                    nextTrack = getTrackFromRelation(nextGroup.items[0].tracks);
                    nextContext = getContextFromItem(nextGroup.items[0]);
                  } else if (nextGroup && !nextGroup.isBlock) {
                    nextTrack = getTrackFromRelation(nextGroup.item.tracks);
                    nextContext = getContextFromItem(nextGroup.item);
                  }

                  const transitionScore = calculateTransitionScore(
                    track,
                    nextTrack,
                    getContextFromItem(group.item),
                    nextContext
                  );

                  return (
                    <div key={group.item.id} className="space-y-2">
                      <article className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.03] p-4">
                        <div className="flex min-w-0 flex-col gap-4">
                          <div className="flex min-w-0 items-start gap-4">
                            <div className="mt-1 shrink-0">
                              <input
                                form="create-block-form"
                                type="checkbox"
                                name="selected_items"
                                value={group.item.id}
                                className="h-5 w-5 rounded border-white/20 bg-slate-900"
                              />
                            </div>

                            <div className="w-6 shrink-0 pt-0.5 text-sm font-bold text-cyan-500">
                              {group.item.position}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3 className="break-words font-bold">
                                {track.title}
                              </h3>
                              <p className="break-words text-xs text-slate-400">
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

                            <div className="flex shrink-0 flex-col items-end gap-2">
                              <div className="flex gap-2">
                                <form action={moveEntityUp}>
                                  <input type="hidden" name="project_id" value={id} />
                                  <input type="hidden" name="entity_id" value={group.item.id} />
                                  <input type="hidden" name="is_block" value="false" />
                                  <button
                                    type="submit"
                                    disabled={isFirst}
                                    className="rounded-lg border border-white/10 px-2 py-1 text-slate-400 transition hover:text-white disabled:opacity-30"
                                  >
                                    ⬆️
                                  </button>
                                </form>

                                <form action={moveEntityDown}>
                                  <input type="hidden" name="project_id" value={id} />
                                  <input type="hidden" name="entity_id" value={group.item.id} />
                                  <input type="hidden" name="is_block" value="false" />
                                  <button
                                    type="submit"
                                    disabled={isLast}
                                    className="rounded-lg border border-white/10 px-2 py-1 text-slate-400 transition hover:text-white disabled:opacity-30"
                                  >
                                    ⬇️
                                  </button>
                                </form>
                              </div>

                              <form action={removeFromTracklist}>
                                <input type="hidden" name="project_id" value={id} />
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

                          <CuratorialEditor projectId={id} item={group.item} />
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