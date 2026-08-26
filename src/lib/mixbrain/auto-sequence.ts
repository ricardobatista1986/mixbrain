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

export type TransitionLock = {
  fromTrackId: string;
  toTrackId: string;
};

/**
 * Funde unidades de uma track só que estão ligadas por um lock de
 * transição (fromTrackId -> toTrackId) numa única SequenceUnit, na mesma
 * lógica que um bloco congelado já usa (múltiplos membros, o algoritmo
 * move o conjunto como uma peça só). Só considera unidades de UM membro —
 * uma track já dentro de um bloco não participa de fusão por lock (as
 * duas ideias não se misturam nessa primeira versão: pra ligar uma track
 * a um bloco, use o bloco).
 *
 * Locks conflitantes (mais de uma cadeia disputando a mesma track) são
 * ignorados silenciosamente a partir do segundo — a unique constraint no
 * banco já impede isso na origem, então na prática nunca deveria
 * acontecer; a checagem aqui é só defesa em profundidade.
 */
export function fuseLockedUnits(
  units: SequenceUnit[],
  locks: TransitionLock[]
): SequenceUnit[] {
  if (locks.length === 0) return units;

  const singleUnitByTrackId = new Map<string, SequenceUnit>();
  const multiMemberUnits: SequenceUnit[] = [];

  for (const unit of units) {
    if (unit.members.length === 1) {
      singleUnitByTrackId.set(unit.entryTrack.id, unit);
    } else {
      multiMemberUnits.push(unit);
    }
  }

  const nextTrackId = new Map<string, string>();
  const hasIncoming = new Set<string>();

  for (const lock of locks) {
    if (lock.fromTrackId === lock.toTrackId) continue;
    if (!singleUnitByTrackId.has(lock.fromTrackId)) continue;
    if (!singleUnitByTrackId.has(lock.toTrackId)) continue;
    if (nextTrackId.has(lock.fromTrackId)) continue;
    if (hasIncoming.has(lock.toTrackId)) continue;

    nextTrackId.set(lock.fromTrackId, lock.toTrackId);
    hasIncoming.add(lock.toTrackId);
  }

  const visited = new Set<string>();
  const fusedUnits: SequenceUnit[] = [...multiMemberUnits];

  for (const trackId of singleUnitByTrackId.keys()) {
    if (visited.has(trackId) || hasIncoming.has(trackId)) continue;

    const chain: SequenceUnit[] = [singleUnitByTrackId.get(trackId)!];
    visited.add(trackId);

    let cursor = trackId;
    while (nextTrackId.has(cursor)) {
      const next = nextTrackId.get(cursor)!;
      if (visited.has(next)) break;
      chain.push(singleUnitByTrackId.get(next)!);
      visited.add(next);
      cursor = next;
    }

    if (chain.length === 1) {
      fusedUnits.push(chain[0]);
      continue;
    }

    const first = chain[0];
    const last = chain[chain.length - 1];
    fusedUnits.push({
      key: `locked-chain:${chain.map((u) => u.key).join(",")}`,
      entryTrack: first.entryTrack,
      exitTrack: last.exitTrack,
      entryContext: first.entryContext,
      exitContext: last.exitContext,
      members: chain.flatMap((u) => u.members),
    });
  }

  // Rede de segurança: um ciclo (A->B e B->A, ou uma cadeia mais longa
  // que fecha em si mesma) faz com que nenhuma das tracks envolvidas
  // tenha "hasIncoming" vazio, então nenhuma delas nunca é escolhida como
  // cabeça de cadeia no loop acima — sem essa rede, elas simplesmente
  // desapareceriam da saída (perda de dados). As locks unique no banco
  // não impedem ciclos de mais de 1 aresta, então isso é alcançável na
  // prática, não só teoricamente. Qualquer track ainda não visitada aqui
  // volta como unidade solta (a trava correspondente é ignorada nesse
  // caso, mas a track nunca some do set).
  for (const [trackId, unit] of singleUnitByTrackId) {
    if (!visited.has(trackId)) {
      fusedUnits.push(unit);
    }
  }

  return fusedUnits;
}

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
export function interpolateTargetEnergy(curve: TargetEnergyCurve, progress: number): number | null {
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
 * É uma heurística gulosa: rápida, determinística e auditável, mas sujeita
 * à armadilha clássica do greedy — gasta as melhores combinações cedo e
 * empurra as piores pro final, sem nunca reconsiderar uma escolha. Por
 * isso o resultado passa por refineSequenceLocalSearch antes de retornar
 * (ver comentário lá).
 */
function buildGreedySequence(
  units: SequenceUnit[],
  weights?: ScoringWeights,
  targetCurve?: TargetEnergyCurve
): SequenceUnit[] {
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

// --- Refinamento pós-construção (busca local) --------------------------
//
// O score de transição do MixBrain não é simétrico (narrativa, timing e
// curva de energia dependem de direção: A→B não "vale" o mesmo que B→A).
// Isso descarta 2-opt clássico, que melhora uma sequência invertendo
// segmentos inteiros — inverter um trecho inverteria também a direção de
// todas as transições internas dele, e o ganho vira aposta, não garantia.
//
// Em vez disso, usa-se busca local com dois tipos de movimento que só
// mexem nas bordas (nunca invertem um trecho por dentro), então são
// seguros com custo assimétrico:
//   - swap adjacente: troca duas unidades vizinhas de posição.
//   - or-opt: tira uma unidade do lugar e reinsere em outra posição
//     próxima (janela limitada, não testa toda posição possível).
// A cada passada, testa todos os movimentos desses dois tipos e aplica o
// primeiro que aumentar o score total da sequência; repete até uma
// passada inteira não melhorar nada (ou até o teto de passadas).
//
// Isso corrige exatamente o erro clássico do greedy (deixar as piores
// transições pro final por nunca reconsiderar uma escolha) sem exigir um
// solver de TSP de verdade — continua O(n² · passadas), tranquilo para
// dezenas ou poucas centenas de tracks.

const OR_OPT_WINDOW = 12;
const MAX_LOCAL_SEARCH_PASSES = 30;

function computeFatiguePenaltyAt(sequence: SequenceUnit[], index: number): number {
  let penalty = 0;
  const window = sequence.slice(Math.max(0, index - FATIGUE_WINDOW), index);
  const unit = sequence[index];

  const artist = normalizeArtist(unit.entryTrack.artist);
  if (artist && window.some((w) => normalizeArtist(w.exitTrack.artist) === artist)) {
    penalty += ARTIST_FATIGUE_PENALTY;
  }

  const key = unit.entryTrack.musical_key;
  if (key && window.some((w) => w.exitTrack.musical_key === key)) {
    penalty += KEY_FATIGUE_PENALTY;
  }

  return penalty;
}

function computeEdgeCategoryPenaltyAt(sequence: SequenceUnit[], index: number): number {
  const unit = sequence[index];
  const moment = unit.entryContext?.curatorial_moment;
  const isFirst = index === 0;
  const isLast = index === sequence.length - 1;

  let penalty = 0;
  if (moment === "closing" && !isLast) penalty += CLOSING_MID_SET_PENALTY;
  if (moment === "opening" && !isFirst) penalty += OPENING_MID_SET_PENALTY;
  if (moment === "peak" && (isFirst || isLast)) penalty += PEAK_AT_EDGE_PENALTY;
  return penalty;
}

function computeEnergyCurvePenaltyAt(
  sequence: SequenceUnit[],
  index: number,
  targetCurve: TargetEnergyCurve | undefined
): number {
  if (!targetCurve) return 0;
  const unit = sequence[index];
  if (unit.entryTrack.energy === null) return 0;

  const progress = sequence.length <= 1 ? 0 : index / (sequence.length - 1);
  const target = interpolateTargetEnergy(targetCurve, Math.min(1, progress));
  if (target === null) return 0;

  return Math.abs(unit.entryTrack.energy - target) * ENERGY_TARGET_PENALTY_PER_POINT;
}

/** Score total de uma sequência completa: soma dos scores de transição entre unidades vizinhas, menos as mesmas penalidades heurísticas usadas na construção gulosa (agora avaliadas por posição absoluta, não incrementalmente). */
function scoreSequence(
  sequence: SequenceUnit[],
  weights: ScoringWeights | undefined,
  targetCurve: TargetEnergyCurve | undefined
): number {
  let total = 0;

  for (let i = 0; i < sequence.length; i += 1) {
    if (i > 0) {
      const transition = calculateTransitionScore(
        sequence[i - 1].exitTrack,
        sequence[i].entryTrack,
        sequence[i - 1].exitContext,
        sequence[i].entryContext,
        weights
      );
      total += transition?.finalScore ?? 0;
    }

    total -= computeFatiguePenaltyAt(sequence, i);
    total -= computeEdgeCategoryPenaltyAt(sequence, i);
    total -= computeEnergyCurvePenaltyAt(sequence, i, targetCurve);
  }

  return total;
}

function refineSequenceLocalSearch(
  initial: SequenceUnit[],
  weights: ScoringWeights | undefined,
  targetCurve: TargetEnergyCurve | undefined
): SequenceUnit[] {
  if (initial.length <= 2) return initial;

  let sequence = initial;
  let bestScore = scoreSequence(sequence, weights, targetCurve);

  for (let pass = 0; pass < MAX_LOCAL_SEARCH_PASSES; pass += 1) {
    let improved = false;

    // Swap adjacente.
    for (let i = 0; i < sequence.length - 1; i += 1) {
      const candidate = [...sequence];
      [candidate[i], candidate[i + 1]] = [candidate[i + 1], candidate[i]];

      const candidateScore = scoreSequence(candidate, weights, targetCurve);
      if (candidateScore > bestScore + 1e-9) {
        sequence = candidate;
        bestScore = candidateScore;
        improved = true;
      }
    }

    // Or-opt: realoca cada unidade dentro de uma janela próxima.
    for (let i = 0; i < sequence.length; i += 1) {
      const from = Math.max(0, i - OR_OPT_WINDOW);
      const to = Math.min(sequence.length - 1, i + OR_OPT_WINDOW);

      for (let j = from; j <= to; j += 1) {
        if (j === i) continue;

        const candidate = [...sequence];
        const [moved] = candidate.splice(i, 1);
        candidate.splice(j, 0, moved);

        const candidateScore = scoreSequence(candidate, weights, targetCurve);
        if (candidateScore > bestScore + 1e-9) {
          sequence = candidate;
          bestScore = candidateScore;
          improved = true;
        }
      }
    }

    if (!improved) break;
  }

  return sequence;
}

export function buildAutoSequence(
  units: SequenceUnit[],
  weights?: ScoringWeights,
  targetCurve?: TargetEnergyCurve
): SequenceUnit[] {
  if (units.length <= 1) return [...units];

  const greedySequence = buildGreedySequence(units, weights, targetCurve);
  return refineSequenceLocalSearch(greedySequence, weights, targetCurve);
}

export type { CuratorialMoment };

/**
 * Normaliza o valor bruto vindo de set_projects.target_energy_curve (jsonb)
 * para o formato tipado usado pelo algoritmo e pela visualização — mesma
 * validação em ambos os lugares, então "sem curva definida" nunca diverge
 * entre o que o auto-organize usa e o que o gráfico mostra.
 */
export function normalizeTargetEnergyCurve(raw: unknown): TargetEnergyCurve | undefined {
  if (!Array.isArray(raw) || raw.length !== 5) return undefined;

  const parsed = raw.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? value : null
  ) as TargetEnergyCurve;

  if (parsed.every((value) => value === null)) return undefined;

  return parsed;
}
