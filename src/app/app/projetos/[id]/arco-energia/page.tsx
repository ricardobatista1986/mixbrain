import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  calculateTransitionScore,
  type CuratorialMoment,
  type ScoreTrack,
  type ScoreTracklistItemContext,
} from "@/lib/mixbrain/transition-score";

type ArcoEnergiaPageProps = { params: Promise<{ id: string }> };

type RawTrackRelation =
  | { id: string; title: string; artist: string | null; bpm: number | null; musical_key: string | null; energy: number | null; mood: string | null }
  | Array<{ id: string; title: string; artist: string | null; bpm: number | null; musical_key: string | null; energy: number | null; mood: string | null }>
  | null;

type RawTracklistItem = { id: string; position: number; block_id: string | null; curatorial_moment: CuratorialMoment | null; tracks: RawTrackRelation };
type ArcItem = { id: string; position: number; block_id: string | null; curatorial_moment: CuratorialMoment | null; track: ScoreTrack };

const MOMENT_LABELS: Record<CuratorialMoment, string> = { opening: "Abertura", build: "Construção", valley: "Vale", peak: "Pico", contemplation: "Contemplação", closing: "Encerramento" };
const MOMENT_COLORS: Record<CuratorialMoment, string> = { opening: "#7fb0d8", build: "#d9a757", valley: "#7fb88a", peak: "#d97757", contemplation: "#a68fd9", closing: "#bdb6ae" };

function getTrackFromRelation(relation: RawTrackRelation): ScoreTrack | null {
  const track = Array.isArray(relation) ? relation[0] : relation;
  if (!track) return null;
  return { id: track.id, title: track.title, artist: track.artist, bpm: track.bpm, musical_key: track.musical_key, energy: track.energy, mood: track.mood };
}
function toContext(moment: CuratorialMoment | null): ScoreTracklistItemContext { return { curatorial_moment: moment }; }

type ArcAlert = { id: string; message: string; tone: "amber" | "rose" };
function buildAlerts(items: ArcItem[]): ArcAlert[] {
  const alerts: ArcAlert[] = [];
  let peakRun = 0; let maxPeakRun = 0; let peakRunStart = 0;
  for (const item of items) { if (item.curatorial_moment === "peak") { if (peakRun === 0) peakRunStart = item.position; peakRun += 1; maxPeakRun = Math.max(maxPeakRun, peakRun); } else peakRun = 0; }
  if (maxPeakRun >= 3) alerts.push({ id: "peaks-in-a-row", tone: "rose", message: `${maxPeakRun} picos consecutivos a partir da posição ${peakRunStart}. Considere intercalar um vale ou contemplação para dar respiro ao set.` });
  if (items.length >= 8 && !items.some((item) => item.curatorial_moment === "valley" || item.curatorial_moment === "contemplation")) alerts.push({ id: "no-release", tone: "amber", message: "Nenhuma track marcada como vale ou contemplação no set inteiro. Um set longo sem respiro pode cansar a pista." });
  let climb = 1; let maxClimb = 1; let climbStart = items[0]?.position ?? 1; let bestClimbStart = climbStart;
  for (let index = 1; index < items.length; index += 1) { const previousEnergy = items[index - 1].track.energy; const currentEnergy = items[index].track.energy; if (previousEnergy !== null && currentEnergy !== null && currentEnergy >= previousEnergy) { if (climb === 1) climbStart = items[index - 1].position; climb += 1; if (climb > maxClimb) { maxClimb = climb; bestClimbStart = climbStart; } } else climb = 1; }
  if (maxClimb >= 5) alerts.push({ id: "long-climb", tone: "amber", message: `Energia subindo ou estável por ${maxClimb} tracks seguidas a partir da posição ${bestClimbStart}. Vale confirmar se não é hora de um respiro.` });
  const missingMoment = items.filter((item) => !item.curatorial_moment).length;
  if (missingMoment > 0) alerts.push({ id: "missing-moment", tone: "amber", message: `${missingMoment} track(s) ainda sem momento curatorial definido. Essas posições aparecem em cinza no mapa.` });
  return alerts;
}

export default async function ArcoEnergiaPage({ params }: ArcoEnergiaPageProps) {
  const { id } = await params; const supabase = await createClient(); const { data: authData } = await supabase.auth.getClaims(); const claims = authData?.claims ?? null; if (!claims?.sub) redirect("/login"); const userId = claims.sub as string;
  const { data: project } = await supabase.from("set_projects").select("id, name, narrative_brief").eq("id", id).eq("user_id", userId).single(); if (!project) redirect("/app");
  const { data: rawItems, error } = await supabase.from("set_tracklist_items").select(`id, position, block_id, curatorial_moment, tracks ( id, title, artist, bpm, musical_key, energy, mood )`).eq("project_id", id).order("position", { ascending: true }); if (error) throw new Error(error.message);
  const items: ArcItem[] = (rawItems as RawTracklistItem[] | null ?? []).map((row) => { const track = getTrackFromRelation(row.tracks); return track ? { id: row.id, position: row.position, block_id: row.block_id, curatorial_moment: row.curatorial_moment, track } : null; }).filter((item): item is ArcItem => item !== null);
  const alerts = buildAlerts(items); const momentCounts = items.reduce((acc, item) => { if (item.curatorial_moment) acc[item.curatorial_moment] = (acc[item.curatorial_moment] ?? 0) + 1; return acc; }, {} as Partial<Record<CuratorialMoment, number>>); const energies = items.map((item) => item.track.energy).filter((value): value is number => value !== null); const averageEnergy = energies.length ? Math.round((energies.reduce((sum, value) => sum + value, 0) / energies.length) * 10) / 10 : null; const maxBarHeight = 140;
  return <main className="min-h-screen px-6 py-10 sm:px-10" style={{ background: "var(--mb-canvas, #1c1a19)", color: "var(--mb-text-primary, #f3efe9)" }}><div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-center justify-between gap-4 pb-6" style={{ borderBottom: "1px solid var(--mb-border, rgba(255,255,255,0.08))" }}><Link href={`/app/projetos/${id}`} className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl font-black" style={{ background: "var(--mb-accent, #d97757)", color: "#1c1a19" }}>M</div><div><p className="font-bold tracking-tight">MixBrain</p><p className="text-xs" style={{ color: "var(--mb-text-muted, #8d8781)" }}>Arco de energia · {project.name}</p></div></Link><Link href={`/app/projetos/${id}`} className="rounded-full px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--mb-border, rgba(255,255,255,0.08))", color: "var(--mb-text-secondary, #bdb6ae)" }}>Voltar ao projeto</Link></header>
    <section className="mt-8 rounded-3xl p-8 sm:p-10" style={{ border: "1px solid var(--mb-accent-soft, rgba(217,119,87,0.14))", background: "linear-gradient(135deg, var(--mb-accent-soft, rgba(217,119,87,0.14)), var(--mb-surface, #262422) 55%, var(--mb-surface, #262422))" }}><p className="text-sm font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--mb-accent-text, #f2b79b)" }}>Fase 7 · Narrativa e momentos curatoriais</p><h1 className="mt-4 text-4xl font-black tracking-tight">Arco de energia do set</h1><p className="mt-5 max-w-3xl text-lg leading-8" style={{ color: "var(--mb-text-secondary, #bdb6ae)" }}>A tracklist lida como uma jornada: energia por posição, momentos curatoriais marcados e alertas não bloqueantes para apoiar a decisão do DJ.</p><div className="mt-6 flex flex-wrap gap-3 text-sm"><span className="rounded-full px-4 py-2" style={{ border: "1px solid var(--mb-border, rgba(255,255,255,0.08))" }}>{items.length} tracks na tracklist</span><span className="rounded-full px-4 py-2" style={{ border: "1px solid var(--mb-border, rgba(255,255,255,0.08))" }}>Energia média: {averageEnergy ?? "—"}</span>{(Object.keys(MOMENT_LABELS) as CuratorialMoment[]).map((moment) => <span key={moment} className="rounded-full px-4 py-2" style={{ border: `1px solid ${MOMENT_COLORS[moment]}55`, color: MOMENT_COLORS[moment] }}>{MOMENT_LABELS[moment]}: {momentCounts[moment] ?? 0}</span>)}</div></section>
    {alerts.length > 0 ? <section className="mt-8 space-y-3"><h2 className="text-lg font-bold">Alertas do arco (não bloqueantes)</h2>{alerts.map((alert) => <div key={alert.id} className="rounded-2xl p-4 text-sm leading-6" style={{ border: `1px solid ${alert.tone === "rose" ? "var(--mb-danger, #e0655f)" : "#d9a757"}`, background: alert.tone === "rose" ? "var(--mb-danger-soft, rgba(224,101,95,0.14))" : "rgba(217,167,87,0.12)" }}>{alert.message}</div>)}</section> : items.length > 0 ? <section className="mt-8 rounded-2xl p-4 text-sm" style={{ border: "1px solid var(--mb-success, #7fb88a)", background: "var(--mb-success-soft, rgba(127,184,138,0.14))" }}>Nenhum alerta identificado: o arco parece bem distribuído.</section> : null}
    <section className="mt-8"><h2 className="mb-4 text-lg font-bold">Mapa temporal do set</h2>{items.length === 0 ? <div className="rounded-2xl p-6" style={{ border: "1px dashed var(--mb-border, rgba(255,255,255,0.08))" }}><p className="text-sm leading-7" style={{ color: "var(--mb-text-secondary, #bdb6ae)" }}>Esta tracklist ainda não tem tracks aprovadas.</p></div> : <div className="overflow-x-auto rounded-3xl p-6" style={{ border: "1px solid var(--mb-border, rgba(255,255,255,0.08))", background: "var(--mb-surface, #262422)" }}><div className="flex items-end gap-2" style={{ minHeight: maxBarHeight + 40 }}>{items.map((item) => { const energy = item.track.energy ?? 0; const barHeight = item.track.energy ? Math.max(12, (energy / 10) * maxBarHeight) : 8; const color = item.curatorial_moment ? MOMENT_COLORS[item.curatorial_moment] : "#5c5854"; return <div key={item.id} className="flex w-10 shrink-0 flex-col items-center gap-1"><div title={`${item.track.title} — Energia ${item.track.energy ?? "—"}`} style={{ width: "100%", height: barHeight, background: color, borderRadius: 6 }} /><span className="text-[10px]" style={{ color: "var(--mb-text-muted, #8d8781)" }}>{item.position}</span></div>; })}</div><div className="mt-6 flex flex-wrap gap-3 text-xs">{(Object.keys(MOMENT_LABELS) as CuratorialMoment[]).map((moment) => <span key={moment} className="flex items-center gap-2"><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: MOMENT_COLORS[moment] }} />{MOMENT_LABELS[moment]}</span>)}<span className="flex items-center gap-2"><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#5c5854" }} />Sem momento</span></div></div>}</section>
    {items.length > 1 ? <section className="mt-8"><h2 className="mb-4 text-lg font-bold">Transições da jornada</h2><div className="space-y-3">{items.slice(0, -1).map((item, index) => { const nextItem = items[index + 1]; const score = calculateTransitionScore(item.track, nextItem.track, toContext(item.curatorial_moment), toContext(nextItem.curatorial_moment)); return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 text-sm" style={{ border: "1px solid var(--mb-border, rgba(255,255,255,0.08))" }}><span style={{ color: "var(--mb-text-secondary, #bdb6ae)" }}>{item.position}. {item.track.title} → {nextItem.position}. {nextItem.track.title}</span><span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--mb-accent-soft, rgba(217,119,87,0.14))", color: "var(--mb-accent-text, #f2b79b)" }}>{score?.finalScore === null || score?.finalScore === undefined ? "Dados insuficientes" : `${score.finalScore}% · ${score.label}`}</span></div>; })}</div></section> : null}
  </div></main>;
}
