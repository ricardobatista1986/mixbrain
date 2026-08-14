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
 * Ponto de partida "natural" de um set, na ausência de qualquer sinal
 * melhor: a unidade com o momento curatorial "opening" já marcado, senão a
 * de menor energia (abertura mais suave é a convenção mais comum), senão a
 * primeira da lista (determinístico).
 */
function pickSeedIndex(units: SequenceUnit[]): number {
  const openingIndex = units.findIndex(
    (unit) => unit.entryContext?.curatorial_moment === "opening"
  );
  if (openingIndex !== -1) return openingIndex;

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

/**
 * Sequenciamento por vizinho mais próximo (nearest neighbor): parte de uma
 * unidade semente e, a cada passo, escolhe entre as unidades restantes
 * aquela com o melhor score de transição em relação à última unidade
 * colocada — usando exatamente a mesma função de score exibida na tela do
 * projeto (harmonia, energia, BPM, mood, diversidade e, quando já houver
 * momento curatorial marcado nos items existentes, narrativa/timing também).
 *
 * Quando o projeto tiver pesos customizados (`set_projects.scoring_weights`),
 * eles são passados para `calculateTransitionScore` e usados na escolha —
 * a heurística de sequenciamento respeita a mesma priorização que o usuário
 * configurou para a explicação de score na UI.
 *
 * É uma heurística gulosa, não uma otimização global (não é um solver de
 * TSP) — mas é determinística, rápida (O(n²), tranquilo para dezenas ou
 * poucas centenas de tracks) e usa o mesmo critério que already explica o
 * score na UI, então o resultado é auditável pelo usuário depois.
 */
export function buildAutoSequence(
  units: SequenceUnit[],
  weights?: ScoringWeights | null
): SequenceUnit[] {
  if (units.length <= 1) return [...units];

  const remaining = [...units];
  const seedIndex = pickSeedIndex(remaining);
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
      const value = score?.finalScore ?? 0;

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
