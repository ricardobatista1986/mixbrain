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

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims?.sub) redirect("/login");
  const userId = authData.claims.sub;

  const { data: project } = await supabase.from("set_projects").select("*").eq("id", id).eq("user_id", userId).single();
  if (!project) redirect("/app");

  const { data: allTracks } = await supabase.from("tracks").select("id, title, artist").eq("user_id", userId).order("created_at", { ascending: false });

  const { data: candidates } = await supabase
    .from("set_candidates")
    .select(`id, track_id, notes, tracks (id, title, artist, bpm, musical_key, energy, mood, source, notes)`)
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  // AQUI BUSCAMOS A TRACKLIST COM OS BLOCOS
  const { data: tracklistItems } = await supabase
    .from("set_tracklist_items")
    .select(`
      id, position, track_id, block_id,
      set_blocks ( name ),
      tracks (id, title, artist, bpm, musical_key, energy, mood)
    `)
    .eq("project_id", id)
    .order("position", { ascending: true });

  const tracklistTrackIds = new Set((tracklistItems ?? []).map((i) => i.track_id));
  const candidateTrackIds = new Set((candidates ?? []).map((c) => c.track_id));

  const pendingCandidates = candidates?.filter((c) => !tracklistTrackIds.has(c.track_id)) ?? [];
  const availableTracks = allTracks?.filter((t) => !candidateTrackIds.has(t.id)) ?? [];

  const addCandidateAction = addCandidate.bind(null, id);

  // AGRUPAMENTO DOS BLOCOS PARA A INTERFACE
  const groupedItems: any[] = [];
  let currentBlock: any = null;

  for (const item of tracklistItems ?? []) {
    if (item.block_id) {
      if (!currentBlock || currentBlock.block_id !== item.block_id) {
        currentBlock = {
          isBlock: true,
          block_id: item.block_id,
          block_name: item.set_blocks?.name || "Bloco",
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
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950">M</div>
            <div>
              <p className="font-bold tracking-tight">MixBrain</p>
              <p className="text-xs text-slate-400">Projeto de set</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/app" className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100">Workspace</Link>
            <Link href="/app/glossario" className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100">Glossário</Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-12 sm:px-10 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* ================= COLUNA CANDIDATAS ================= */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Candidatas</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Tracks disponíveis</h2>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300">{pendingCandidates.length}</span>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/40 p-5">
              <h3 className="mb-3 text-sm font-bold text-slate-300">Adicionar da biblioteca</h3>
              <form action={addCandidateAction} className="flex flex-col gap-3">
                <select name="trackId" className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-100 outline-none" required>
                  <option value="">Selecione uma track...</option>
                  {availableTracks.map((t) => <option key={t.id} value={t.id}>{t.title} {t.artist ? `- ${t.artist}` : ""}</option>)}
                </select>
                <input type="text" name="notes" placeholder="Nota ou intenção..." className="w-full rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-100 outline-none" />
                <button type="submit" className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700">Adicionar Candidata</button>
              </form>
            </div>

            <div className="mt-6 space-y-4">
              {pendingCandidates.map((candidate) => {
                const track = Array.isArray(candidate.tracks) ? candidate.tracks[0] : candidate.tracks;
                if (!track) return null;
                return (
                  <article key={candidate.id} className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
                    <div className="flex justify-between gap-4">
                      <div><h3 className="text-lg font-bold">{track.title}</h3><p className="text-sm text-slate-400">{track.artist}</p></div>
                      <form action={approveCandidateToTracklist}>
                        <input type="hidden" name="project_id" value={id} />
                        <input type="hidden" name="track_id" value={track.id} />
                        <button type="submit" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 hover:opacity-90">Aprovar</button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ================= COLUNA TRACKLIST E BLOCOS ================= */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Tracklist</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Sequência e Blocos</h2>
              </div>
            </div>

            {/* FORMULÁRIO INVISÍVEL QUE CONTROLA O AGRUPAMENTO */}
            <form id="create-block-form" action={createFrozenBlock}>
              <input type="hidden" name="project_id" value={id} />
            </form>

            <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-900/50 p-4 border border-white/10">
              <input form="create-block-form" type="text" name="block_name" placeholder="Nome do bloco..." className="bg-transparent text-sm text-white outline-none w-1/2" required />
              <button form="create-block-form" type="submit" className="rounded-full bg-indigo-500/20 px-4 py-1.5 text-sm font-bold text-indigo-300 transition hover:bg-indigo-500/30">
                Congelar Selecionadas
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {groupedItems.length === 0 && <div className="text-slate-400 p-6">Nenhuma track aprovada.</div>}
              
              {groupedItems.map((group, index) => {
                const isFirst = index === 0;
                const isLast = index === groupedItems.length - 1;

                if (group.isBlock) {
                  return (
                    <div key={`block-${group.block_id}`} className="rounded-2xl border-2 border-indigo-500/30 bg-indigo-500/[0.03] p-2 sm:p-4">
                      <div className="mb-4 flex items-center justify-between px-2">
                        <div className="flex items-center gap-3">
                          <span className="text-indigo-400 font-bold tracking-tight">❄️ {group.block_name}</span>
                          <span className="text-xs text-indigo-400/50">{group.items.length} tracks</span>
                        </div>
                        <div className="flex gap-2">
                          <form action={moveEntityUp}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="entity_id" value={group.block_id}/><input type="hidden" name="is_block" value="true"/><button disabled={isFirst} className="p-1 text-slate-400 hover:text-white disabled:opacity-30">⬆️</button></form>
                          <form action={moveEntityDown}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="entity_id" value={group.block_id}/><input type="hidden" name="is_block" value="true"/><button disabled={isLast} className="p-1 text-slate-400 hover:text-white disabled:opacity-30">⬇️</button></form>
                          <form action={dissolveFrozenBlock}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="block_id" value={group.block_id}/><button className="p-1 text-rose-400 hover:text-rose-300 ml-2">Desfazer</button></form>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((item: any) => {
                          const track = Array.isArray(item.tracks) ? item.tracks[0] : item.tracks;
                          return (
                            <article key={item.id} className="rounded-xl border border-white/5 bg-slate-900/50 p-3 pl-4 flex gap-4">
                              <div className="w-6 text-sm font-bold text-slate-500">{item.position}</div>
                              <div><p className="font-bold text-sm text-slate-200">{track.title}</p><p className="text-xs text-slate-400">{track.artist}</p></div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // RENDERING SINGLE TRACK (NOT IN A BLOCK)
                const track = Array.isArray(group.item.tracks) ? group.item.tracks[0] : group.item.tracks;
                return (
                  <article key={group.item.id} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.03] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <input form="create-block-form" type="checkbox" name="selected_items" value={group.item.id} className="w-5 h-5 rounded border-white/20 bg-slate-900" />
                        <div className="w-6 text-sm font-bold text-cyan-500">{group.item.position}</div>
                        <div><h3 className="font-bold">{track.title}</h3><p className="text-xs text-slate-400">{track.artist}</p></div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <form action={moveEntityUp}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="entity_id" value={group.item.id}/><input type="hidden" name="is_block" value="false"/><button disabled={isFirst} className="text-slate-400 hover:text-white disabled:opacity-30">⬆️</button></form>
                          <form action={moveEntityDown}><input type="hidden" name="project_id" value={id}/><input type="hidden" name="entity_id" value={group.item.id}/><input type="hidden" name="is_block" value="false"/><button disabled={isLast} className="text-slate-400 hover:text-white disabled:opacity-30">⬇️</button></form>
                        </div>
                        <form action={removeFromTracklist} className="text-right">
                          <input type="hidden" name="project_id" value={id}/><input type="hidden" name="tracklist_item_id" value={group.item.id}/>
                          <button className="text-xs text-rose-400 hover:text-rose-300">Remover</button>
                        </form>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}