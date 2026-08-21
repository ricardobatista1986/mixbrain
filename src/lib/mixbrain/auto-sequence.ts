import {
  calculateTransitionScore,
  type CuratorialMoment,
  type ScoreTrack,
  type ScoreTracklistItemContext,
  type ScoringWeights,
} from "./transition-score";

export type SequenceMember =
  | { kind: "existing"; itemId: string }
  | { kind: "new"; trackId: string };

export type SequenceUnit = {
  /** Identificador só para debug/testes, não usado na persistência. */
  key: string;
  /** Track que "recebe" a transição vinda da unidade anterior. */
  entryTrack: ScoreTrack;
  /** Track que "entrega" a transição para a próxima unidade. */
  exitTrack: ScoreTrack;
  entryContext: ScoreTracklistItemContext | null;
  exitContext: ScoreTracklistItemContext | null;
  /**
   * Membros na ordem final dentro da unidade. Para uma track avulsa, é um
   * único membro. Para um bloco congelado, é a lista de items do bloco na
   * ordem interna já existente — essa ordem nunca é alterada pelo algoritmo,
   * só a posição do bloco inteiro na sequência.
   */
  members: SequenceMember[];
};

/**
 * Curva de energia alvo definida pelo usuário: 5 pontos de controle nas
 * marcas 0%, 25%, 50%, 75% e 100% do set, escala 1-10. `null` num ponto
 * significa "sem preferência ali" (não interfere na escolha).
 */
export type TargetEnergyCurve = [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null
];

const FATIGUE_WINDOW = 3;
const ARTIST_FATIGUE_PENALTY = 15;
const KEY_FATIGUE_PENALTY = 8;
const CLOSING_MID_SET_PENALTY = 25;
const OPENING_MID_SET_PENALTY = 20;
const PEAK_AT_EDGE_PENALTY = 15;
const ENERGY_TARGET_PENALTY_PER_POINT = 6;

/**
 * Ponto de partida "natural" de um set, na ausência de qualquer sinal
 * melhor: a unidade com o momento curatorial "opening" já marcado, senão a
 * mais próxima do primeiro ponto da curva de energia alvo (se houver),
 * senão a de menor energia (abertura mais suave é a convenção mais
 * comum), senão a primeira da lista (determinístico).
 */
function pickSeedIndex(units: SequenceUnit[], targetCurve?: TargetEnergyCurve): number {
  const openingIndex = units.findIndex(
    (unit) => unit.entryContext?.curatorial_moment === "opening"
  );
  if (openingIndex !== -1) return openingIndex;

  const targetStart = targetCurve?.[0];
  if (targetStart !== null && targetStart !== undefined) {
    let bestIndex = -1;
    let bestDistance = Infinity;
    units.forEach((unit, index) => {
      if (unit.entryTrack.energy === null) return;
      const distance = Math.abs(unit.entryTrack.energy - targetStart);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    if (bestIndex !== -1) return bestIndex;
  }

  let bestIndex = -1;
  let bestEnergy = Infinity;
  units.forEach((unit, index) => {
    if (unit.entryTrack.energy !== null && unit.entryTrack.energy < bestEnergy) {
      bestEnergy = unit.entryTrack.energy;
      bestIndex = index;
    }
  });

  return bestIndex !== -1 ? bestIndex : 0;
}

/** Interpola a curva de energia alvo (5 pontos em 0/25/50/75/100%) numa posição relativa 0..1. */
function interpolateTargetEnergy(curve: TargetEnergyCurve, progress: number): number | null {
  const checkpoints = [0, 0.25, 0.5, 0.75, 1];
  const defined = curve
    .map((value, index) => ({ value, position: checkpoints[index] }))
    .filter((point): point is { value: number; position: number } => point.value !== null);

  if (defined.length === 0) return null;
  if (defined.length === 1) return defined[0].value;

  for (let i = 0; i < defined.length - 1; i += 1) {
    const a = defined[i];
    const b = defined[i + 1];
    if (progress >= a.position && progress <= b.position) {
      const span = b.position - a.position;
      const t = span === 0 ? 0 : (progress - a.position) / span;
      return a.value + (b.value - a.value) * t;
    }
  }

  return progress < defined[0].position ? defined[0].value : defined[defined.length - 1].value;
}

function normalizeArtist(artist: string | null) {
  return (artist ?? "").trim().toLocaleLowerCase("pt-BR");
}

/**
 * Penalidades heurísticas aplicadas por cima do score de transição, para
 * guiar a escolha do PRÓXIMO passo na sequência (não alteram o score
 * exibido na tela, que continua puramente pairwise/explicável):
 *
 * - Fadiga de artista/key: evita repetir o mesmo artista ou a mesma key
 *   dentro de uma janela de 3 tracks, não só na track imediatamente
 *   anterior.
 * - Categorias de ponta: desestimula colocar uma track marcada como
 *   "closing" no meio do set, "opening" fora do início, ou "peak" bem nas
 *   pontas.
 * - Curva de energia alvo: se o projeto definiu uma curva-alvo, desestimula
 *   candidatas cuja energia esteja longe do valor esperado para aquela
 *   posição relativa do set.
 */
function computeSelectionPenalty(
  candidate: SequenceUnit,
  sequenceSoFar: SequenceUnit[],
  remainingCount: number,
  totalUnits: number,
  targetCurve: TargetEnergyCurve | undefined
): number {
  let penalty = 0;

  const recentWindow = sequenceSoFar.slice(-FATIGUE_WINDOW);
  const candidateArtist = normalizeArtist(candidate.entryTrack.artist);
  if (
    candidateArtist &&
    recentWindow.some((unit) => normalizeArtist(unit.exitTrack.artist) === candidateArtist)
  ) {
    penalty += ARTIST_FATIGUE_PENALTY;
  }

  const candidateKey = candidate.entryTrack.musical_key;
  if (
    candidateKey &&
    recentWindow.some((unit) => unit.exitTrack.musical_key === candidateKey)
  ) {
    penalty += KEY_FATIGUE_PENALTY;
  }

  const moment = candidate.entryContext?.curatorial_moment;
  const isFirstPick = sequenceSoFar.length === 0;
  const isLastPick = remainingCount === 1;

  if (moment === "closing" && !isLastPick) {
    penalty += CLOSING_MID_SET_PENALTY;
  }
  if (moment === "opening" && !isFirstPick) {
    penalty += OPENING_MID_SET_PENALTY;
  }
  if (moment === "peak" && (isFirstPick || isLastPick)) {
    penalty += PEAK_AT_EDGE_PENALTY;
  }

  if (targetCurve && candidate.entryTrack.energy !== null) {
    const progress = totalUnits <= 1 ? 0 : sequenceSoFar.length / (totalUnits - 1);
    const target = interpolateTargetEnergy(targetCurve, Math.min(1, progress));
    if (target !== null) {
      const deviation = Math.abs(candidate.entryTrack.energy - target);
      penalty += deviation * ENERGY_TARGET_PENALTY_PER_POINT;
    }
  }

  return penalty;
}

/**
 * Sequenciamento por vizinho mais próximo (nearest neighbor): parte de uma
 * unidade semente e, a cada passo, escolhe entre as unidades restantes
 * aquela com o melhor score de transição em relação à última unidade
 * colocada — usando exatamente a mesma função de score exibida na tela do
 * projeto (harmonia, energia, BPM, mood, diversidade e, quando já houver
 * momento curatorial marcado nos items existentes, narrativa/timing também)
 * — ajustado por penalidades de fadiga, categorias de ponta e curva de
 * energia alvo (ver computeSelectionPenalty).
 *
 * É uma heurística gulosa, não uma otimização global (não é um solver de
 * TSP) — mas é determinística, rápida (O(n²), tranquilo para dezenas ou
 * poucas centenas de tracks) e usa o mesmo critério que já explica o
 * score na UI, então o resultado é auditável pelo usuário depois.
 */
export function buildAutoSequence(
  units: SequenceUnit[],
  weights?: ScoringWeights,
  targetCurve?: TargetEnergyCurve
): SequenceUnit[] {
  if (units.length <= 1) return [...units];

  const remaining = [...units];
  const seedIndex = pickSeedIndex(remaining, targetCurve);
  const sequence: SequenceUnit[] = [remaining.splice(seedIndex, 1)[0]];

  while (remaining.length > 0) {
    const last = sequence[sequence.length - 1];

    let bestIndex = 0;
    let bestScore = -Infinity;

    remaining.forEach((candidate, index) => {
      const score = calculateTransitionScore(
        last.exitTrack,
        candidate.entryTrack,
        last.exitContext,
        candidate.entryContext,
        weights
      );
      const baseValue = score?.finalScore ?? 0;
      const penalty = computeSelectionPenalty(
        candidate,
        sequence,
        remaining.length,
        units.length,
        targetCurve
      );
      const value = baseValue - penalty;

      if (value > bestScore) {
        bestScore = value;
        bestIndex = index;
      }
    });

    sequence.push(remaining.splice(bestIndex, 1)[0]);
  }

  return sequence;
}

export type { CuratorialMoment };
