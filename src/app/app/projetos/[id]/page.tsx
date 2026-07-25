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

type CamelotParsed = {
  number: number;
  letter: "A" | "B";
};

function parseCamelot(value: string | null | undefined): CamelotParsed | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^([1-9]|1[0-2])(A|B)$/);

  if (!match) return null;

  return {
    number: Number(match[1]),
    letter: match[2] as "A" | "B",
  };
}

function camelotDistance(a: number, b: number) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 12 - diff);
}

function getKeyScore(
  currentKey: string | null | undefined,
  nextKey: string | null | undefined
) {
  const a = parseCamelot(currentKey);
  const b = parseCamelot(nextKey);

  if (!a || !b) {
    return {
      score: 50,
      label: "Key indefinida",
      tone: "text-slate-400 border-white/10 bg-white/[0.03]",
    };
  }

  if (a.number === b.number && a.letter === b.letter) {
    return {
      score: 100,
      label: "Mesma key",
      tone: "text-emerald-200 border-emerald-300/30 bg-emerald-300/10",
    };
  }

  if (a.number === b.number && a.letter !== b.letter) {
    return {
      score: 92,
      label: "Relativa maior/menor",
      tone: "text-emerald-200 border-emerald-300/30 bg-emerald-300/10",
    };
  }

  const distance = camelotDistance(a.number, b.number);

  if (distance === 1 && a.letter === b.letter) {
    return {
      score: 88,
      label: "Vizinha harmônica",
      tone: "text-cyan-200 border-cyan-300/30 bg-cyan-300/10",
    };
  }

  if (distance === 2 && a.letter === b.letter) {
    return {
      score: 72,
      label: "Energy boost",
      tone: "text-amber-200 border-amber-300/30 bg-amber-300/10",
    };
  }

  return {
    score: 35,
    label: "Relação distante",
    tone: "text-rose-200 border-rose-300/30 bg-rose-300/10",
  };
}

function getBpmScore(
  currentBpm: number | null | undefined,
  nextBpm: number | null | undefined
) {
  if (
    currentBpm === null ||
    currentBpm === undefined ||
    nextBpm === null ||
    nextBpm === undefined
  ) {
    return {
      score: 50,
      label: "BPM indefinido",
    };
  }

  const diff = Math.abs(currentBpm - nextBpm);

  if (diff === 0) return { score: 100, label: "Mesmo BPM" };
  if (diff <= 1) return { score: 92, label: "Quase igual" };
  if (diff <= 2) return { score: 84, label: "Muito próximo" };
  if (diff <= 4) return { score: 70, label: "Aceitável" };
  if (diff <= 6) return { score: 55, label: "Mudança perceptível" };

  return { score: 30, label: "Salto grande" };
}

function getEnergyScore(
  currentEnergy: number | null | undefined,
  nextEnergy: number | null | undefined
) {
  if (
    currentEnergy === null ||
    currentEnergy === undefined ||
    nextEnergy === null ||
    nextEnergy === undefined
  ) {
    return {
      score: 50,
      label: "Energia indefinida",
    };
  }

  const diff = Math.abs(currentEnergy - nextEnergy);

  if (diff === 0) return { score: 100, label: "Mesmo nível" };
  if (diff <= 1) return { score: 90, label: "Muito próxima" };
  if (diff <= 2) return { score: 75, label: "Próxima" };
  if (diff <= 3) return { score: 58, label: "Mudança perceptível" };

  return { score: 35, label: "Mudança forte" };
}

function getTransitionCompatibility(
  currentTrack: Track | null | undefined,
  nextTrack: Track | null | undefined
) {
  if (!nextTrack) {
    return null;
  }

  const bpm = getBpmScore(currentTrack?.bpm, nextTrack?.bpm);
  const key = getKeyScore(currentTrack?.musical_key, nextTrack?.musical_key);
  const energy = getEnergyScore(currentTrack?.energy, nextTrack?.energy);

  const finalScore = Math.round(
    bpm.score * 0.3 + key.score * 0.45 + energy.score * 0.25
  );

  let label = "Fraca";
  let tone = "text-rose-200 border-rose-300/30 bg-rose-300/10";

  if (finalScore >= 85) {
    label = "Excelente";
    tone = "text-emerald-200 border-emerald-300/30 bg-emerald-300/10";
  } else if (finalScore >= 70) {
    label = "Boa";
    tone = "text-cyan-200 border-cyan-300/30 bg-cyan-300/10";
  } else if (finalScore >= 55) {
    label = "Média";
    tone = "text-amber-200 border-amber-300/30 bg-amber-300/10";
  }

  return {
    finalScore,
    label,
    tone,
    reasons: {
      bpm,
      key,
      energy,
    },
  };
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims?.sub) redirect("/login");
  const userId = authData.claims.sub;

  const { data: project } = await supabase
    .from("set_projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (!project) redirect("/app");

  const { data: allTracks } = await supabase
    .from("tracks")
    .select("id, title, artist")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const { data: candidates } = await supabase
    .from("set_candidates")
    .select(`
      id, track_id, notes,
      tracks (
        id, title, artist, bpm, musical_key, energy, mood, source, notes
      )
    `)
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const { data: tracklistItems } = await supabase
    .from("set_tracklist_items")
    .select(`
      id, position, track_id, block_id,
      set_blocks ( name ),
      tracks (
        id, title, artist, bpm, musical_key, energy, mood
      )
    `)
    .eq("project_id", id)
    .order("position", { ascending: true });

  const tracklistTrackIds = new Set((tracklistItems ?? []).map((i) => i.track_id));
  const candidateTrackIds = new Set((candidates ?? []).map((c) => c.track_id));

  const pendingCandidates =
    candidates?.filter((c) => !tracklistTrackIds.has(c.track_id)) ?? [];

  const availableTracks =
    allTracks?.filter((t) => !candidateTrackIds.has(t.id)) ?? [];

  const addCandidateAction = addCandidate.bind(null, id);

  const groupedItems: GroupedItem[] = [];
  let currentBlock: GroupedBlock | null = null;

  for (const item of tracklistItems ?? []) {
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
      groupedItems.push({ isBlock: false, item });
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10 lg:px-12">
          <Link href="/app" className="flex items-center gap-3 transition hover:opacity-80">
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
                  {availableTracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} {t.artist ? `- ${t.artist}` : ""}
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

                  if (!track) return null;

                  return (
                    <article
                      key={candidate.id}
                      className="rounded-2xl border border-white/10 bg-slate-900/50 p-5"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold">{track.title}</h3>
                          <p className="text-sm text-slate-400">{track.artist}</p>
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
                              <input
                                type="hidden"
                                name="entity_id"
                                value={group.block_id}
                              />
                              <input type="hidden" name="is_block" value="true" />
                              <button
                                disabled={isFirst}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                ⬆️
                              </button>
                            </form>

                            <form action={moveEntityDown}>
                              <input type="hidden" name="project_id" value={id} />
                              <input
                                type="hidden"
                                name="entity_id"
                                value={group.block_id}
                              />
                              <input type="hidden" name="is_block" value="true" />
                              <button
                                disabled={isLast}
                                className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              >
                                ⬇️
                              </button>
                            </form>

                            <form action={dissolveFrozenBlock}>
                              <input type="hidden" name="project_id" value={id} />
                              <input type="hidden" name="block_id" value={group.block_id} />
                              <button className="ml-2 p-1 text-rose-400 hover:text-rose-300">
                                Desfazer
                              </button>
                            </form>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {group.items.map((item: TracklistItem, itemIndex: number) => {
                            const track = Array.isArray(item.tracks)
                              ? item.tracks[0]
                              : item.tracks;

                            const nextItem = group.items[itemIndex + 1];
                            const nextTrack = nextItem
                              ? Array.isArray(nextItem.tracks)
                                ? nextItem.tracks[0]
                                : nextItem.tracks
                              : null;

                            const compatibility = getTransitionCompatibility(
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
                                      {track.artist}
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

                                {compatibility ? (
                                  <div
                                    className={`rounded-xl border p-3 text-sm ${compatibility.tone}`}
                                  >
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="font-bold">
                                        Compatibilidade com a próxima:{" "}
                                        {compatibility.finalScore}%
                                      </span>
                                      <span>{compatibility.label}</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                      <span className="rounded-full border border-current/20 px-2 py-1">
                                        BPM: {compatibility.reasons.bpm.label}
                                      </span>
                                      <span className="rounded-full border border-current/20 px-2 py-1">
                                        Key: {compatibility.reasons.key.label}
                                      </span>
                                      <span className="rounded-full border border-current/20 px-2 py-1">
                                        Energia: {compatibility.reasons.energy.label}
                                      </span>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  const nextGroup: GroupedItem | undefined = groupedItems[index + 1];
                    let nextTrack: Track | null = null;

                    if (nextGroup?.isBlock) {
                    nextTrack = Array.isArray(nextGroup.items[0].tracks)
                        ? nextGroup.items[0].tracks[0]
                        : nextGroup.items[0].tracks;
                    } else if (nextGroup && !nextGroup.isBlock) {
                    nextTrack = Array.isArray(nextGroup.item.tracks)
                        ? nextGroup.item.tracks[0]
                        : nextGroup.item.tracks;
                    }

                  const nextGroup = groupedItems[index + 1];
                  let nextTrack = null;

                  if (nextGroup?.isBlock) {
                    nextTrack = Array.isArray(nextGroup.items[0].tracks)
                      ? nextGroup.items[0].tracks[0]
                      : nextGroup.items[0].tracks;
                  } else if (nextGroup?.item) {
                    nextTrack = Array.isArray(nextGroup.item.tracks)
                      ? nextGroup.item.tracks[0]
                      : nextGroup.item.tracks;
                  }

                  const compatibility = getTransitionCompatibility(track, nextTrack);

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
                              <p className="text-xs text-slate-400">{track.artist}</p>

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
                                <input type="hidden" name="project_id" value={id} />
                                <input
                                  type="hidden"
                                  name="entity_id"
                                  value={group.item.id}
                                />
                                <input type="hidden" name="is_block" value="false" />
                                <button
                                  disabled={isFirst}
                                  className="text-slate-400 hover:text-white disabled:opacity-30"
                                >
                                  ⬆️
                                </button>
                              </form>

                              <form action={moveEntityDown}>
                                <input type="hidden" name="project_id" value={id} />
                                <input
                                  type="hidden"
                                  name="entity_id"
                                  value={group.item.id}
                                />
                                <input type="hidden" name="is_block" value="false" />
                                <button
                                  disabled={isLast}
                                  className="text-slate-400 hover:text-white disabled:opacity-30"
                                >
                                  ⬇️
                                </button>
                              </form>
                            </div>

                            <form action={removeFromTracklist} className="text-right">
                              <input type="hidden" name="project_id" value={id} />
                              <input
                                type="hidden"
                                name="tracklist_item_id"
                                value={group.item.id}
                              />
                              <button className="text-xs text-rose-400 hover:text-rose-300">
                                Remover
                              </button>
                            </form>
                          </div>
                        </div>
                      </article>

                      {compatibility ? (
                        <div
                          className={`rounded-xl border p-3 text-sm ${compatibility.tone}`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-bold">
                              Compatibilidade com a próxima: {compatibility.finalScore}%
                            </span>
                            <span>{compatibility.label}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-current/20 px-2 py-1">
                              BPM: {compatibility.reasons.bpm.label}
                            </span>
                            <span className="rounded-full border border-current/20 px-2 py-1">
                              Key: {compatibility.reasons.key.label}
                            </span>
                            <span className="rounded-full border border-current/20 px-2 py-1">
                              Energia: {compatibility.reasons.energy.label}
                            </span>
                          </div>
                        </div>
                      ) : null}
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