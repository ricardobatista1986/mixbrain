import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { EditProjectForm } from "@/components/edit-project-form";
import { DeleteProjectButton } from "@/components/delete-project-button";
import { AddCandidateForm } from "@/components/add-candidate-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { AutoOrganizeButton } from "@/components/auto-organize-button";
import { LibrarySuggestions } from "@/components/library-suggestions";
import { OutlierCandidatesBox } from "@/components/outlier-candidates-box";
import { SetVersionsPanel } from "@/components/set-versions-panel";
import { ExportTracklistButtons, type ExportRow } from "@/components/export-tracklist-buttons";
import {
  TransitionDecisionControls,
  type TransitionDecision,
} from "@/components/transition-decision-controls";
import { CurationTimeline, type CurationEventSummary } from "@/components/curation-timeline";
import { ScoringWeightsPanel } from "@/components/scoring-weights-panel";
import { EnergyCurveEditor } from "@/components/energy-curve-editor";
import { TrackMatchesPanel } from "@/components/track-matches-panel";
import { RejectCandidateButton } from "@/components/reject-candidate-button";
import {
  HARMONIC_RELATION_META,
  ENERGY_DIRECTION_META,
  classifyHarmonicRelation,
  classifyEnergyDirection,
  type HarmonicRelation,
  type EnergyDirection,
} from "@/lib/mixbrain/camelot";
import {
  interpolateTargetEnergy,
  normalizeTargetEnergyCurve,
} from "@/lib/mixbrain/auto-sequence";
import { BridgeSuggestions, type BridgeSuggestionTrack } from "@/components/bridge-suggestions";
import { EnergyArcChart, type EnergyPoint } from "@/components/energy-arc-chart";
import { ProjectTabs } from "@/components/project-tabs";
import { TracklistDragList } from "@/components/tracklist-drag-list";
import { createClient } from "@/lib/supabase/server";
import {
  approveCandidateToTracklist,
  createFrozenBlock,
  dissolveFrozenBlock,
  lockTransition,
  moveEntityDown,
  moveEntityUp,
  removeFromTracklist,
  unlockTransition,
  updateCuratorialFields,
} from "./actions";
import {
  calculateTransitionScore,
  normalizeScoringWeights,
  type CuratorialMoment,
  type ScoreTrack,
  type ScoreTracklistItemContext,
  type ScoringWeights,
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

/**
 * Sugestões de bridge para uma transição fraca: procura, num recorte da
 * biblioteca ainda não usada no projeto, tracks que fariam uma ponte
 * melhor — boa saída da track A e boa entrada na track B. Só vale a pena
 * chamar para transições já identificadas como fracas/atenção; caso
 * contrário não haveria motivo para sugerir uma ponte.
 */
function computeBridgeSuggestions(
  trackA: ScoreTrack,
  trackB: ScoreTrack,
  pool: ScoreTrack[],
  weights: ScoringWeights | undefined,
  excludeIds: Set<string>
): BridgeSuggestionTrack[] {
  return pool
    .filter((candidate) => !excludeIds.has(candidate.id))
    .map((candidate) => {
      const scoreIn = calculateTransitionScore(trackA, candidate, null, null, weights)?.finalScore;
      const scoreOut = calculateTransitionScore(candidate, trackB, null, null, weights)?.finalScore;

      if (scoreIn === undefined || scoreOut === undefined || scoreIn === null || scoreOut === null) {
        return null;
      }

      return {
        id: candidate.id,
        title: candidate.title,
        artist: candidate.artist || "Artista não informado",
        bpm: candidate.bpm,
        musical_key: candidate.musical_key,
        score: Math.round((scoreIn + scoreOut) / 2),
      };
    })
    .filter((entry): entry is BridgeSuggestionTrack => entry !== null && entry.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function getScoreToneClasses(score: TransitionScore) {
  const tones = {
    emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
    cyan: "border-claude-accent/30 bg-claude-accent/10 text-claude-accent-hover",
    amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    rose: "border-rose-300/30 bg-rose-300/10 text-rose-100",
    slate: "border-claude-border bg-claude-surface text-claude-text",
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
                <span className="text-claude-text-muted">
                  85% a 100%. Transição perfeita e sem atrito.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full border border-claude-accent/30 bg-claude-accent/10 px-2 py-0.5 text-[10px] font-bold text-claude-accent-hover">
                  BOA
                </span>
                <span className="text-claude-text-muted">
                  70% a 84%. Mixável e funcional narrativamente.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-bold text-amber-100">
                  ATENÇÃO
                </span>
                <span className="text-claude-text-muted">
                  55% a 69%. Exige técnica, ponte ou pausa de respiro.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full border border-rose-300/30 bg-rose-300/10 px-2 py-0.5 text-[10px] font-bold text-rose-100">
                  FRACA
                </span>
                <span className="text-claude-text-muted">
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
            <ul className="space-y-2 text-sm text-claude-text-muted">
              <li>
                <strong className="text-claude-text">Abertura:</strong> Introdução do set, clima inicial.
              </li>
              <li>
                <strong className="text-claude-text">Construção:</strong> Elevando a energia, preparando o terreno.
              </li>
              <li>
                <strong className="text-claude-text">Vale:</strong> Respiro, quebra de expectativa ou tensão pré-pico.
              </li>
              <li>
                <strong className="text-claude-text">Pico:</strong> Clímax, catarse, maior entrega de energia.
              </li>
              <li>
                <strong className="text-claude-text">Contemplação:</strong> Densidade emocional, viagem sonora reflexiva.
              </li>
              <li>
                <strong className="text-claude-text">Encerramento:</strong> Desfecho e conclusão da narrativa.
              </li>
            </ul>
          </div>

          {/* Os 7 Fatores */}
          <div>
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-300">
              Os 7 Fatores (Pesos)
            </h4>
            <ul className="space-y-1.5 text-sm text-claude-text-muted">
              <li>
                <strong className="text-claude-text">Narrativa (28%):</strong> Coerência da jornada.
              </li>
              <li>
                <strong className="text-claude-text">Timing/Momento (22%):</strong> Relação da track com a fase do set.
              </li>
              <li>
                <strong className="text-claude-text">Harmonia (16%):</strong> Transições no círculo de Camelot.
              </li>
              <li>
                <strong className="text-claude-text">Energia (13%):</strong> Controle de choques ou continuidades.
              </li>
              <li>
                <strong className="text-claude-text">Mood (9%):</strong> Texturas compartilhadas.
              </li>
              <li>
                <strong className="text-claude-text">BPM (7%):</strong> Diferença percentual de tempo.
              </li>
              <li>
                <strong className="text-claude-text">Diversidade (5%):</strong> Variação inteligente de artistas.
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
  projectId,
  fromTrackId,
  toTrackId,
  decision,
  bridgeSuggestions,
  isLocked,
  canCreateLock = true,
  harmonicRelation,
  energyDirection,
}: {
  score: TransitionScore | null;
  projectId?: string;
  fromTrackId?: string;
  toTrackId?: string;
  decision?: TransitionDecision | null;
  bridgeSuggestions?: BridgeSuggestionTrack[];
  isLocked?: boolean;
  /**
   * false quando a próxima track pertence a um bloco congelado: travar
   * esse par ficaria salvo no banco mas sem nenhum efeito no
   * auto-organize (fuseLockedUnits só funde tracks soltas, não entra
   * bloco por dentro nem gruda algo numa borda dele) — nesse caso o
   * botão de CRIAR trava não é mostrado, pra não prometer um
   * comportamento que o algoritmo não cumpre. Destravar continua
   * disponível sempre, mesmo aqui, pra permitir limpar uma trava velha
   * que ficou "presa" depois que a track virou membro de um bloco.
   */
  canCreateLock?: boolean;
  harmonicRelation?: HarmonicRelation;
  energyDirection?: EnergyDirection;
}) {
  if (!score) return null;

  const harmonicMeta = harmonicRelation ? HARMONIC_RELATION_META[harmonicRelation] : null;
  const energyMeta = energyDirection ? ENERGY_DIRECTION_META[energyDirection] : null;

  return (
    <details className={`rounded-xl border p-3 ${getScoreToneClasses(score)}`}>
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">
              Score MixBrain: {score.finalScore === null ? "—" : `${score.finalScore}%`}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-80">
              {harmonicMeta ? (
                <span title={harmonicMeta.description}>
                  {harmonicMeta.icon} {harmonicMeta.label}
                </span>
              ) : null}
              {energyMeta ? (
                <span title={energyMeta.label}>
                  {energyMeta.icon} {energyMeta.label}
                </span>
              ) : null}
              {!harmonicMeta && !energyMeta ? <span>Para a transição até a próxima track.</span> : null}
              {projectId && (harmonicMeta || energyMeta) ? (
                <a
                  href={`/app/glossario?projeto=${projectId}#relacoes-harmonicas`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted underline-offset-2 hover:text-claude-accent"
                >
                  o que significa?
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLocked ? (
              <span
                title="Essa transição está travada: o auto-organize sempre mantém essas duas tracks adjacentes, nessa ordem."
                className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[11px] font-bold text-amber-200"
              >
                🔒 travada
              </span>
            ) : null}
            {decision ? (
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                  decision.status === "approved"
                    ? "border-emerald-300/40 text-emerald-200"
                    : "border-rose-300/40 text-rose-200"
                }`}
              >
                {decision.status === "approved" ? "✓ aprovada" : "✗ rejeitada"}
              </span>
            ) : null}
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
              className="rounded-lg border border-current/15 bg-claude-surface/20 p-3"
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

        {projectId && fromTrackId && toTrackId ? (
          <TransitionDecisionControls
            projectId={projectId}
            fromTrackId={fromTrackId}
            toTrackId={toTrackId}
            decision={decision ?? null}
          />
        ) : null}

        {projectId && fromTrackId && toTrackId && (isLocked || canCreateLock) ? (
          <form
            action={isLocked ? unlockTransition : lockTransition}
            className="mt-3"
          >
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="from_track_id" value={fromTrackId} />
            {isLocked ? null : (
              <input type="hidden" name="to_track_id" value={toTrackId} />
            )}
            <button
              type="submit"
              className="rounded-lg border border-current/20 px-3 py-1.5 text-xs font-bold transition hover:bg-claude-surface/30"
            >
              {isLocked
                ? "🔓 Destravar transição"
                : "🔒 Travar esta transição no auto-organize"}
            </button>
          </form>
        ) : null}

        {projectId && bridgeSuggestions && bridgeSuggestions.length > 0 ? (
          <BridgeSuggestions projectId={projectId} suggestions={bridgeSuggestions} />
        ) : null}
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
      className="mt-3 rounded-xl border border-claude-border bg-claude-surface/40 p-3"
    >
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="tracklist_item_id" value={item.id} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] text-claude-text-muted">
            Momento no set
          </label>
          <select
            name="curatorial_moment"
            defaultValue={item.curatorial_moment ?? ""}
            className="w-full rounded-xl border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none"
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
            className="w-full rounded-xl bg-claude-surface-3 px-4 py-2 text-sm font-bold text-white transition hover:bg-claude-surface-3 sm:w-auto"
          >
            Salvar
          </button>
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] text-claude-text-muted">
          Por que essa track está aqui (opcional)
        </label>
        <textarea
          name="curatorial_intent"
          defaultValue={item.curatorial_intent ?? ""}
          placeholder="Ex.: bridge entre o vale hipnótico e a retomada de energia — prepara a key da próxima sem soar repetitiva."
          rows={2}
          maxLength={2000}
          className="w-full resize-y rounded-xl border border-claude-border bg-claude-surface px-3 py-2 text-sm text-claude-text outline-none placeholder:text-claude-text-faint"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-claude-text-muted">
        <span className="rounded-full border border-claude-border px-3 py-1">
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
      sort_order,
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
    .order("sort_order", { ascending: true })
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

  // --- Decisões de aprovação/rejeição de transição já registradas -----
  // approved_transitions referencia set_candidates, não tracks direto, então
  // resolvemos candidate_id -> track_id em JS usando os candidatos já
  // carregados, em vez de um join ambíguo (duas FKs pra mesma tabela).
  const { data: transitionDecisionRows } = await supabase
    .from("approved_transitions")
    .select("from_candidate_id, to_candidate_id, status, explanation")
    .eq("project_id", id);

  const candidateTrackById = new Map(
    (candidates ?? []).map((candidate) => [candidate.id, candidate.track_id])
  );

  const transitionDecisionByTrackPair = new Map<string, TransitionDecision>();

  for (const row of transitionDecisionRows ?? []) {
    const fromTrackId = candidateTrackById.get(row.from_candidate_id);
    const toTrackId = candidateTrackById.get(row.to_candidate_id);

    if (fromTrackId && toTrackId && (row.status === "approved" || row.status === "rejected")) {
      transitionDecisionByTrackPair.set(`${fromTrackId}:${toTrackId}`, {
        status: row.status,
        explanation: row.explanation,
      });
    }
  }

  function getTransitionDecision(
    fromTrackId: string | undefined,
    toTrackId: string | undefined
  ): TransitionDecision | null {
    if (!fromTrackId || !toTrackId) return null;
    return transitionDecisionByTrackPair.get(`${fromTrackId}:${toTrackId}`) ?? null;
  }

  const { data: transitionLockRows } = await supabase
    .from("set_transition_locks")
    .select("from_track_id, to_track_id")
    .eq("project_id", id);

  const lockedTransitions = new Set(
    (transitionLockRows ?? []).map((row) => `${row.from_track_id}:${row.to_track_id}`)
  );

  function isTransitionLocked(
    fromTrackId: string | undefined,
    toTrackId: string | undefined
  ): boolean {
    if (!fromTrackId || !toTrackId) return false;
    return lockedTransitions.has(`${fromTrackId}:${toTrackId}`);
  }

  const scoringWeights: ScoringWeights | undefined = normalizeScoringWeights(
    project.scoring_weights
  );

  const { data: rawCurationEvents } = await supabase
    .from("curation_events")
    .select("id, event_type, payload, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const curationEvents: CurationEventSummary[] = (rawCurationEvents ?? []).map((event) => ({
    id: event.id,
    eventType: event.event_type,
    payload: (event.payload as Record<string, unknown> | null) ?? null,
    createdAt: event.created_at,
  }));

  const pendingCandidates =
    candidates?.filter((candidate) => !tracklistTrackIds.has(candidate.track_id)) ?? [];

  const availableTracks =
    allTracks?.filter((track) => !candidateTrackIds.has(track.id)) ?? [];

  const bridgePool = availableTracks.slice(0, 150) as ScoreTrack[];

  // --- Classificação de fora do padrão (BPM destoante) ---------------
  // Critério primário: faixa de BPM definida no próprio projeto (bpm_min/
  // bpm_max), com uma margem pequena de tolerância. Sem faixa definida,
  // cai para um critério estatístico simples: distância da mediana de BPM
  // das próprias candidatas pendentes. Sem dado de BPM, a track nunca é
  // classificada como fora do padrão — falta de informação não é motivo
  // para excluir.
  const candidateBpms = pendingCandidates
    .map((candidate) => getTrackFromRelation(candidate.tracks)?.bpm)
    .filter((bpm): bpm is number => typeof bpm === "number");

  const sortedCandidateBpms = [...candidateBpms].sort((a, b) => a - b);
  const medianCandidateBpm =
    sortedCandidateBpms.length > 0
      ? sortedCandidateBpms[Math.floor(sortedCandidateBpms.length / 2)]
      : null;

  function classifyBpmFit(bpm: number | null | undefined): {
    outlier: boolean;
    reason: string;
  } {
    if (typeof bpm !== "number") return { outlier: false, reason: "" };

    if (project.bpm_min !== null && project.bpm_max !== null) {
      const margin = 3;
      if (bpm < project.bpm_min - margin || bpm > project.bpm_max + margin) {
        return {
          outlier: true,
          reason: `BPM ${bpm} fora da faixa definida no projeto (${project.bpm_min}–${project.bpm_max})`,
        };
      }
      return { outlier: false, reason: "" };
    }

    if (medianCandidateBpm !== null && sortedCandidateBpms.length >= 3) {
      const distance = Math.abs(bpm - medianCandidateBpm);
      if (distance > medianCandidateBpm * 0.12) {
        return {
          outlier: true,
          reason: `BPM ${bpm} destoa da mediana das candidatas (~${medianCandidateBpm})`,
        };
      }
    }

    return { outlier: false, reason: "" };
  }

  const classifiedCandidates = pendingCandidates.map((candidate) => {
    const track = getTrackFromRelation(candidate.tracks);
    const { outlier, reason } = classifyBpmFit(track?.bpm);
    return { candidate, track, outlier, reason };
  });

  const fittingCandidates = classifiedCandidates
    .filter((entry) => !entry.outlier)
    .map((entry) => entry.candidate);

  const outlierCandidatesForBox = classifiedCandidates
    .filter((entry) => entry.outlier && entry.track)
    .map((entry) => ({
      candidateId: entry.candidate.id,
      title: entry.track!.title,
      artist: entry.track!.artist || "Artista não informado",
      reason: entry.reason,
    }));

  // --- Sugestões inteligentes da biblioteca ---------------------------
  // "Pool" = uma amostra do que já está no projeto (tracklist aprovada +
  // candidatas pendentes). Cada track disponível na biblioteca recebe um
  // score médio de compatibilidade contra essa amostra, reaproveitando a
  // mesma calculateTransitionScore usada em todo o resto da tela.
  const poolForSuggestions: ScoreTrack[] = [
    ...tracklistItems
      .map((item) => getTrackFromRelation(item.tracks))
      .filter((track): track is ScoreTrack => track !== null),
    ...pendingCandidates
      .map((candidate) => getTrackFromRelation(candidate.tracks))
      .filter((track): track is ScoreTrack => track !== null),
  ].slice(0, 15);

  function scoreAgainstPool(track: ScoreTrack): number | null {
    if (poolForSuggestions.length === 0) return null;

    const scores = poolForSuggestions
      .map((poolTrack) => calculateTransitionScore(poolTrack, track, null, null, scoringWeights)?.finalScore)
      .filter((score): score is number => typeof score === "number");

    if (scores.length === 0) return null;

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  const suggestionSourceTracks =
    poolForSuggestions.length > 0
      ? availableTracks
      : [...availableTracks].slice(0, 12);

  const rankedSuggestions = suggestionSourceTracks
    .map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist ?? "Artista não informado",
      bpm: track.bpm,
      musical_key: track.musical_key,
      energy: track.energy,
      mood: track.mood,
      score: poolForSuggestions.length > 0 ? scoreAgainstPool(track as ScoreTrack) : null,
    }))
    // Sem pool ainda (projeto vazio), não há score real — mantém a ordem
    // recente sem filtrar por qualidade. Com pool, corta sugestões fracas:
    // "sugestão" só vale a pena mostrar se realmente encaixa.
    .filter((suggestion) => poolForSuggestions.length === 0 || (suggestion.score ?? 0) >= 55)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  // Diversidade: no máximo 2 sugestões do mesmo artista, pra não lotar a
  // lista com o catálogo inteiro de um único artista quando ele domina a
  // biblioteca (comum em bases importadas de um só produtor/label).
  const suggestionCountByArtist = new Map<string, number>();
  const librarySuggestions = rankedSuggestions
    .filter((suggestion) => {
      const count = suggestionCountByArtist.get(suggestion.artist) ?? 0;
      if (count >= 2) return false;
      suggestionCountByArtist.set(suggestion.artist, count + 1);
      return true;
    })
    .slice(0, 12);


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

  const exportRows: ExportRow[] = groupedItems.flatMap((group) => {
    if (group.isBlock) {
      return group.items
        .map((item): ExportRow | null => {
          const track = getTrackFromRelation(item.tracks);
          if (!track) return null;
          return {
            position: item.position,
            title: track.title,
            artist: track.artist || "Artista não informado",
            bpm: track.bpm,
            musical_key: track.musical_key,
            energy: track.energy,
            mood: track.mood,
            blockName: group.block_name,
          };
        })
        .filter((row): row is ExportRow => row !== null);
    }

    const track = getTrackFromRelation(group.item.tracks);
    if (!track) return [];

    const row: ExportRow = {
      position: group.item.position,
      title: track.title,
      artist: track.artist || "Artista não informado",
      bpm: track.bpm,
      musical_key: track.musical_key,
      energy: track.energy,
      mood: track.mood,
      blockName: null,
    };

    return [row];
  });

  const flatTracklist = groupedItems.flatMap((group) => {
    const items = group.isBlock ? group.items : [group.item];
    return items
      .map((item) => {
        const track = getTrackFromRelation(item.tracks);
        if (!track) return null;
        return { track, context: getContextFromItem(item) };
      })
      .filter((entry): entry is { track: ScoreTrack; context: ScoreTracklistItemContext | null } => entry !== null);
  });

  const transitionSummary = { Excelente: 0, Boa: 0, Atenção: 0, Fraca: 0, "Dados insuficientes": 0 };
  for (let i = 0; i < flatTracklist.length - 1; i += 1) {
    const score = calculateTransitionScore(
      flatTracklist[i].track,
      flatTracklist[i + 1].track,
      flatTracklist[i].context,
      flatTracklist[i + 1].context,
      scoringWeights
    );
    if (score) transitionSummary[score.label] += 1;
  }
  const totalTransitions = flatTracklist.length - 1;

  const projectPoolTracksMap = new Map<string, ScoreTrack>();
  for (const entry of flatTracklist) {
    projectPoolTracksMap.set(entry.track.id, entry.track);
  }
  for (const candidate of pendingCandidates) {
    const track = getTrackFromRelation(candidate.tracks);
    if (track) projectPoolTracksMap.set(track.id, track);
  }
  const projectPoolTracks = [...projectPoolTracksMap.values()];
  const projectPoolTrackIds = new Set(projectPoolTracks.map((track) => track.id));
  const fullLibraryTracks = (allTracks ?? []) as ScoreTrack[];

  const energyPoints: EnergyPoint[] = groupedItems.flatMap((group) => {
    const items = group.isBlock ? group.items : [group.item];
    return items
      .map((item): EnergyPoint | null => {
        const track = getTrackFromRelation(item.tracks);
        if (!track) return null;
        return {
          position: item.position,
          title: track.title,
          energy: track.energy,
          moment: item.curatorial_moment,
        };
      })
      .filter((point): point is EnergyPoint => point !== null);
  });

  const normalizedTargetCurve = normalizeTargetEnergyCurve(project.target_energy_curve);
  const targetCurvePoints =
    normalizedTargetCurve && energyPoints.length > 1
      ? energyPoints
          .map((_, index) => {
            const progress = index / (energyPoints.length - 1);
            const energy = interpolateTargetEnergy(normalizedTargetCurve, progress);
            return energy === null
              ? null
              : { positionPercent: (index / (energyPoints.length - 1)) * 100, energy };
          })
          .filter((point): point is { positionPercent: number; energy: number } => point !== null)
      : undefined;

  const { data: rawVersions } = await supabase
    .from("set_versions")
    .select("id, name, created_at, snapshot")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const setVersions = (rawVersions ?? []).map((version) => {
    const snapshot = version.snapshot as { items?: unknown[] } | null;
    return {
      id: version.id,
      name: version.name,
      createdAt: version.created_at,
      trackCount: Array.isArray(snapshot?.items) ? snapshot.items.length : 0,
    };
  });

  return (
    <main className="min-h-screen bg-claude-bg text-claude-text">
      <header className="border-b border-claude-border bg-claude-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 sm:px-10 lg:px-12">
          <Link
            href="/app"
            className="flex items-center gap-3 transition hover:opacity-80"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-claude-accent font-black text-claude-bg">
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MixBrain</p>
              <p className="text-xs text-claude-text-muted">Projeto de set</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="rounded-full border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted transition hover:border-claude-accent/50 hover:text-claude-accent-hover"
            >
              Workspace
            </Link>
            <Link
              href={`/app/glossario?projeto=${id}`}
              className="rounded-full border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted transition hover:border-claude-accent/50 hover:text-claude-accent-hover"
            >
              Glossário
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="border-b border-claude-border bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_40%)]">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-10 lg:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
            Projeto
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            {project.name}
          </h1>

          {project.description ? (
            <p className="mt-5 max-w-3xl text-lg leading-8 text-claude-text-muted">
              {project.description}
            </p>
          ) : (
            <p className="mt-5 max-w-3xl text-lg leading-8 text-claude-text-muted">
              Este projeto ainda não tem descrição.
            </p>
          )}

          <details className="group mt-8 max-w-3xl overflow-hidden rounded-2xl border border-claude-border bg-claude-surface">
            <summary className="cursor-pointer list-none px-5 py-3 text-sm font-bold text-claude-text-muted transition hover:text-claude-accent-hover">
              <span className="mr-2 inline-block transition-transform group-open:rotate-90">
                ▶
              </span>
              Editar projeto (nome, descrição, BPM alvo e direção narrativa)
            </summary>
            <div className="border-t border-claude-border p-5">
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

              <div className="mt-6 border-t border-claude-border pt-6">
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

        <ProjectTabs
          tabs={[
            {
              key: "curadoria",
              label: "Curadoria & Tracklist",
              content: (
                <>
                  <div className="grid gap-8 lg:grid-cols-2">
          <section className="rounded-3xl border border-claude-border bg-claude-surface p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
                  Candidatas
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Tracks disponíveis
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-claude-border px-3 py-1 text-sm text-claude-text-muted">
                  {fittingCandidates.length}
                </span>
                {outlierCandidatesForBox.length > 0 ? (
                  <a
                    href="#outliers"
                    className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200 transition hover:bg-amber-300/20"
                  >
                    ⚠ {outlierCandidatesForBox.length} para revisar ↓
                  </a>
                ) : null}
              </div>
            </div>

            <div className="mt-6">
              <AddCandidateForm projectId={id} availableTracks={availableTracks} />
            </div>

            <LibrarySuggestions
              projectId={id}
              suggestions={librarySuggestions}
              hasPool={poolForSuggestions.length > 0}
            />

            <div className="mt-6 space-y-4">
              {fittingCandidates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-claude-border p-6 text-center">
                  <p className="text-claude-text-muted">
                    Sem candidatas na fila de aprovação ainda.
                  </p>
                  <p className="mt-2 text-sm text-claude-text-faint">
                    Use a busca acima para adicionar da biblioteca, ou{" "}
                    <Link href="/app/importar-csv" className="font-semibold text-claude-accent hover:underline">
                      importe um CSV
                    </Link>{" "}
                    direto para este projeto.
                  </p>
                </div>
              ) : (
                fittingCandidates.map((candidate) => {
                  const track = Array.isArray(candidate.tracks)
                    ? candidate.tracks[0]
                    : candidate.tracks;

                  if (!track) return null;

                  return (
                    <article
                      key={candidate.id}
                      className="rounded-2xl border border-claude-border bg-claude-surface/50 p-5"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold">{track.title}</h3>
                          <p className="text-sm text-claude-text-muted">
                            {track.artist || "Artista não informado"}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-start gap-2">
                          <form action={approveCandidateToTracklist}>
                            <input type="hidden" name="project_id" value={id} />
                            <input type="hidden" name="track_id" value={track.id} />

                            <button
                              type="submit"
                              className="rounded-full bg-claude-accent px-4 py-2 text-sm font-bold text-claude-bg hover:opacity-90"
                            >
                              Aprovar
                            </button>
                          </form>

                          <RejectCandidateButton projectId={id} candidateId={candidate.id} />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-claude-text-muted">
                        <span className="rounded-full border border-claude-border px-3 py-1">
                          BPM: {track.bpm ?? "—"}
                        </span>
                        <span className="rounded-full border border-claude-border px-3 py-1">
                          Key: {track.musical_key ?? "—"}
                        </span>
                        <span className="rounded-full border border-claude-border px-3 py-1">
                          Energia: {track.energy ?? "—"}
                        </span>
                        {track.mood ? (
                          <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-violet-200">
                            {track.mood}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div id="outliers">
              <OutlierCandidatesBox
                projectId={id}
                candidates={outlierCandidatesForBox}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-claude-border bg-claude-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
                  Tracklist
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Sequência e Blocos
                </h2>
              </div>

              <ExportTracklistButtons rows={exportRows} projectName={project.name} />
            </div>

            <div className="mt-4 rounded-2xl border border-indigo-400/20 bg-indigo-400/[0.06] p-4">
              <p className="text-sm font-bold text-indigo-100">
                Organizar tracklist automaticamente
              </p>
              <p className="mt-1 text-xs leading-5 text-indigo-200/80">
                Aprova todas as candidatas pendentes e reordena a tracklist
                inteira com base em harmonia (Camelot), energia, BPM, mood e
                diversidade — o mesmo critério do score exibido abaixo em
                cada transição. Blocos congelados mantêm a ordem interna, só
                mudam de posição no set. Você pode ajustar manualmente
                depois.
              </p>
              <AutoOrganizeButton projectId={id} />
            </div>

            <form id="create-block-form" action={createFrozenBlock}>
              <input type="hidden" name="project_id" value={id} />
            </form>

            <div className="mt-6 flex items-center justify-between rounded-xl border border-claude-border bg-claude-surface/50 p-4">
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
              {totalTransitions > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-claude-border bg-claude-surface/40 px-4 py-3 text-xs">
                  <span className="font-bold text-claude-text">
                    {totalTransitions} transiç{totalTransitions === 1 ? "ão" : "ões"}:
                  </span>
                  {transitionSummary.Excelente > 0 ? (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-semibold text-emerald-300">
                      {transitionSummary.Excelente} excelente{transitionSummary.Excelente === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {transitionSummary.Boa > 0 ? (
                    <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 font-semibold text-sky-300">
                      {transitionSummary.Boa} boa{transitionSummary.Boa === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {transitionSummary["Atenção"] > 0 ? (
                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-semibold text-amber-300">
                      {transitionSummary["Atenção"]} pedindo atenção
                    </span>
                  ) : null}
                  {transitionSummary.Fraca > 0 ? (
                    <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 font-semibold text-rose-300">
                      {transitionSummary.Fraca} fraca{transitionSummary.Fraca === 1 ? "" : "s"}
                    </span>
                  ) : null}
                  {transitionSummary["Dados insuficientes"] > 0 ? (
                    <span className="rounded-full border border-claude-border px-2.5 py-1 font-semibold text-claude-text-muted">
                      {transitionSummary["Dados insuficientes"]} sem dados suficientes
                    </span>
                  ) : null}
                </div>
              ) : null}

              {groupedItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-claude-border p-6 text-center">
                  <p className="text-claude-text-muted">Nenhuma track aprovada ainda.</p>
                  <p className="mt-2 text-sm text-claude-text-faint">
                    {pendingCandidates.length > 0
                      ? `Você tem ${pendingCandidates.length} candidata(s) esperando. Aprove uma a uma ao lado, ou clique em "Gerar ordem automática" acima para o MixBrain montar a tracklist inteira de uma vez.`
                      : "Adicione candidatas ao lado primeiro — depois é só aprovar manualmente ou gerar a ordem automática."}
                  </p>
                </div>
              ) : (
                <TracklistDragList
                  projectId={id}
                  items={groupedItems
                    .map((group, index) => {
                  const isFirst = index === 0;
                  const isLast = index === groupedItems.length - 1;

                  if (group.isBlock) {
                    const lastMemberItem = group.items[group.items.length - 1];
                    const lastTrack = getTrackFromRelation(lastMemberItem?.tracks);
                    const nextGroupAfterBlock = groupedItems[index + 1];

                    let afterBlockTrack: ScoreTrack | null = null;
                    let afterBlockContext: ScoreTracklistItemContext | null = null;
                    let afterBlockItem: TracklistItem | null = null;

                    if (nextGroupAfterBlock?.isBlock) {
                      afterBlockItem = nextGroupAfterBlock.items[0];
                      afterBlockTrack = getTrackFromRelation(afterBlockItem?.tracks);
                      afterBlockContext = getContextFromItem(afterBlockItem);
                    } else if (nextGroupAfterBlock && !nextGroupAfterBlock.isBlock) {
                      afterBlockItem = nextGroupAfterBlock.item;
                      afterBlockTrack = getTrackFromRelation(afterBlockItem?.tracks);
                      afterBlockContext = getContextFromItem(afterBlockItem);
                    }

                    const afterBlockScore =
                      lastTrack && afterBlockTrack
                        ? calculateTransitionScore(
                            lastTrack,
                            afterBlockTrack,
                            getContextFromItem(lastMemberItem),
                            afterBlockContext,
                            scoringWeights
                          )
                        : null;

                    return {
                      id: `block-${group.block_id}`,
                      memberIds: group.items.map((item) => item.id),
                      node: (
                        <>
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
                                className="p-1 text-claude-text-muted hover:text-white disabled:opacity-30"
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
                                className="p-1 text-claude-text-muted hover:text-white disabled:opacity-30"
                              >
                                ⬇️
                              </button>
                            </form>

                            <form action={dissolveFrozenBlock} className="ml-2">
                              <input type="hidden" name="project_id" value={id} />
                              <input type="hidden" name="block_id" value={group.block_id} />
                              <ConfirmSubmitButton
                                className="p-1 text-rose-400 hover:text-rose-300"
                                confirmClassName="p-1 font-bold text-rose-300 hover:text-rose-200"
                              >
                                Desfazer
                              </ConfirmSubmitButton>
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
                              getContextFromItem(nextItem),
                              scoringWeights
                            );

                            return (
                              <div key={item.id} className="space-y-2">
                                <article className="rounded-lg border border-claude-border/60 bg-claude-surface/50 px-3 py-2">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <span className="w-6 shrink-0 text-sm font-bold text-claude-text-faint">
                                      {item.position}
                                    </span>

                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-bold text-claude-text">
                                        {track.title}
                                      </p>
                                      <p className="truncate text-xs text-claude-text-muted">
                                        {track.artist || "Artista não informado"}
                                      </p>
                                    </div>

                                    <div className="hidden shrink-0 items-center gap-3 text-[11px] text-claude-text-muted md:flex">
                                      <span className="w-16 text-right">
                                        {track.bpm ? `${track.bpm} BPM` : "BPM —"}
                                      </span>
                                      <span className="w-10">{track.musical_key ?? "Key —"}</span>
                                      <span className="w-8">
                                        {track.energy ? `E${track.energy}` : "E —"}
                                      </span>
                                      <span className="w-24 truncate">{track.mood ?? "—"}</span>
                                    </div>
                                  </div>

                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-[11px] font-semibold text-claude-text-faint hover:text-claude-text-muted">
                                      Detalhes e momento no set
                                    </summary>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-claude-text-muted md:hidden">
                                      <span className="rounded-full border border-claude-border px-3 py-1">
                                        BPM: {track.bpm ?? "—"}
                                      </span>
                                      <span className="rounded-full border border-claude-border px-3 py-1">
                                        Key: {track.musical_key ?? "—"}
                                      </span>
                                      <span className="rounded-full border border-claude-border px-3 py-1">
                                        Energia: {track.energy ?? "—"}
                                      </span>
                                      <span className="rounded-full border border-claude-border px-3 py-1">
                                        Mood: {track.mood ?? "—"}
                                      </span>
                                    </div>
                                    <CuratorialEditor projectId={id} item={item} />
                                    <div className="mt-2">
                                      <TrackMatchesPanel
                                        target={track}
                                        pools={[
                                          { label: "Neste projeto", tracks: projectPoolTracks },
                                          { label: "Biblioteca inteira", tracks: fullLibraryTracks },
                                        ]}
                                        weights={scoringWeights}
                                        projectId={id}
                                        existingProjectTrackIds={projectPoolTrackIds}
                                      />
                                    </div>
                                  </details>
                                </article>

                                <TransitionScoreCard
                                  score={transitionScore}
                                  projectId={id}
                                  fromTrackId={track.id}
                                  toTrackId={nextTrack?.id}
                                  decision={getTransitionDecision(track.id, nextTrack?.id)}
                                  isLocked={isTransitionLocked(track.id, nextTrack?.id)}
                                  harmonicRelation={classifyHarmonicRelation(
                                    track.musical_key,
                                    nextTrack?.musical_key
                                  )}
                                  energyDirection={classifyEnergyDirection(
                                    track.energy,
                                    nextTrack?.energy
                                  )}
                                  bridgeSuggestions={
                                    nextTrack &&
                                    transitionScore &&
                                    (transitionScore.label === "Fraca" ||
                                      transitionScore.label === "Atenção")
                                      ? computeBridgeSuggestions(
                                          track,
                                          nextTrack,
                                          bridgePool,
                                          scoringWeights,
                                          new Set()
                                        )
                                      : undefined
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {lastTrack && afterBlockTrack ? (
                        <div className="mt-3">
                          <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-claude-text-faint">
                            Saída do bloco → próxima track
                          </p>
                          <TransitionScoreCard
                            score={afterBlockScore}
                            projectId={id}
                            fromTrackId={lastTrack.id}
                            toTrackId={afterBlockTrack.id}
                            decision={getTransitionDecision(lastTrack.id, afterBlockTrack.id)}
                            isLocked={isTransitionLocked(lastTrack.id, afterBlockTrack.id)}
                            canCreateLock={false}
                            harmonicRelation={classifyHarmonicRelation(
                              lastTrack.musical_key,
                              afterBlockTrack.musical_key
                            )}
                            energyDirection={classifyEnergyDirection(
                              lastTrack.energy,
                              afterBlockTrack.energy
                            )}
                            bridgeSuggestions={
                              afterBlockScore &&
                              (afterBlockScore.label === "Fraca" ||
                                afterBlockScore.label === "Atenção")
                                ? computeBridgeSuggestions(
                                    lastTrack,
                                    afterBlockTrack,
                                    bridgePool,
                                    scoringWeights,
                                    new Set()
                                  )
                                : undefined
                            }
                          />
                        </div>
                      ) : null}
                        </>
                      ),
                    };
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
                    nextContext,
                    scoringWeights
                  );

                  return {
                    id: group.item.id,
                    memberIds: [group.item.id],
                    node: (
                    <div key={group.item.id} className="space-y-2">
                      <article className="rounded-xl border border-claude-accent/20 bg-claude-accent/[0.03] px-4 py-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-3">
                          <input
                            form="create-block-form"
                            type="checkbox"
                            name="selected_items"
                            value={group.item.id}
                            className="h-4 w-4 shrink-0 rounded border-claude-border bg-claude-surface"
                          />

                          <span className="w-6 shrink-0 text-sm font-bold text-claude-accent">
                            {group.item.position}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{track.title}</p>
                            <p className="truncate text-xs text-claude-text-muted">
                              {track.artist || "Artista não informado"}
                            </p>
                          </div>

                          <div className="hidden shrink-0 items-center gap-3 text-[11px] text-claude-text-muted md:flex">
                            <span className="w-16 text-right">
                              {track.bpm ? `${track.bpm} BPM` : "BPM —"}
                            </span>
                            <span className="w-10">{track.musical_key ?? "Key —"}</span>
                            <span className="w-8">
                              {track.energy ? `E${track.energy}` : "E —"}
                            </span>
                            <span className="w-24 truncate">{track.mood ?? "—"}</span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <form action={moveEntityUp}>
                              <input type="hidden" name="project_id" value={id} />
                              <input type="hidden" name="entity_id" value={group.item.id} />
                              <input type="hidden" name="is_block" value="false" />
                              <button
                                type="submit"
                                disabled={isFirst}
                                className="rounded-lg border border-claude-border px-2 py-1 text-claude-text-muted transition hover:text-white disabled:opacity-30"
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
                                className="rounded-lg border border-claude-border px-2 py-1 text-claude-text-muted transition hover:text-white disabled:opacity-30"
                              >
                                ⬇️
                              </button>
                            </form>

                            <form action={removeFromTracklist}>
                              <input type="hidden" name="project_id" value={id} />
                              <input
                                type="hidden"
                                name="tracklist_item_id"
                                value={group.item.id}
                              />
                              <ConfirmSubmitButton>Remover</ConfirmSubmitButton>
                            </form>
                          </div>
                        </div>

                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] font-semibold text-claude-text-faint hover:text-claude-text-muted">
                            Detalhes e momento no set
                          </summary>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-claude-text-muted md:hidden">
                            <span className="rounded-full border border-claude-border px-3 py-1">
                              BPM: {track.bpm ?? "—"}
                            </span>
                            <span className="rounded-full border border-claude-border px-3 py-1">
                              Key: {track.musical_key ?? "—"}
                            </span>
                            <span className="rounded-full border border-claude-border px-3 py-1">
                              Energia: {track.energy ?? "—"}
                            </span>
                            <span className="rounded-full border border-claude-border px-3 py-1">
                              Mood: {track.mood ?? "—"}
                            </span>
                          </div>
                          <CuratorialEditor projectId={id} item={group.item} />
                          <div className="mt-2">
                            <TrackMatchesPanel
                              target={track}
                              pools={[
                                { label: "Neste projeto", tracks: projectPoolTracks },
                                { label: "Biblioteca inteira", tracks: fullLibraryTracks },
                              ]}
                              weights={scoringWeights}
                              projectId={id}
                              existingProjectTrackIds={projectPoolTrackIds}
                            />
                          </div>
                        </details>
                      </article>

                      <TransitionScoreCard
                        score={transitionScore}
                        projectId={id}
                        fromTrackId={track.id}
                        toTrackId={nextTrack?.id}
                        decision={getTransitionDecision(track.id, nextTrack?.id)}
                        isLocked={isTransitionLocked(track.id, nextTrack?.id)}
                        canCreateLock={!nextGroup?.isBlock}
                        harmonicRelation={classifyHarmonicRelation(
                          track.musical_key,
                          nextTrack?.musical_key
                        )}
                        energyDirection={classifyEnergyDirection(track.energy, nextTrack?.energy)}
                        bridgeSuggestions={
                          nextTrack &&
                          transitionScore &&
                          (transitionScore.label === "Fraca" ||
                            transitionScore.label === "Atenção")
                            ? computeBridgeSuggestions(
                                track,
                                nextTrack,
                                bridgePool,
                                scoringWeights,
                                new Set()
                              )
                            : undefined
                        }
                      />
                    </div>
                    ),
                  };
                })
                .filter((dragItem): dragItem is NonNullable<typeof dragItem> => dragItem !== null)}
                />
              )}
            </div>
          </section>
        </div>

        <div className="mt-8">
          <EnergyArcChart points={energyPoints} targetCurve={targetCurvePoints} />
        </div>
                </>
              ),
            },
            {
              key: "config",
              label: "Configurações & Histórico",
              content: (
                <>
                  <div className="grid gap-8 lg:grid-cols-2">
          <ScoringWeightsPanel
            projectId={id}
            currentWeights={scoringWeights ?? {}}
          />
          <CurationTimeline events={curationEvents} />
        </div>

        <div className="mt-8">
          <EnergyCurveEditor
            projectId={id}
            currentCurve={
              Array.isArray(project.target_energy_curve)
                ? (project.target_energy_curve as (number | null)[])
                : null
            }
          />
        </div>

        <div className="mt-8">
          <SetVersionsPanel
            projectId={id}
            versions={setVersions}
            tracklistEmpty={groupedItems.length === 0}
          />
        </div>
                </>
              ),
            },
          ]}
        />
      </section>
    </main>
  );
}