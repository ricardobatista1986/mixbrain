import { makeTrackKey } from "./track-identity";

export type ScoreTrack = {
  id: string;
  title: string;
  artist: string | null;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
};

export type CuratorialMoment =
  | "opening"
  | "build"
  | "valley"
  | "peak"
  | "contemplation"
  | "closing";

export type ScoreTracklistItemContext = {
  curatorial_moment: CuratorialMoment | null;
};

type CamelotKey = {
  number: number;
  letter: "A" | "B";
};

export type ScoreFactorStatus = "available" | "missing" | "pending";

export type ScoreFactor = {
  id:
    | "narrative"
    | "timing"
    | "harmony"
    | "energy"
    | "mood"
    | "bpm"
    | "diversity";
  title: string;
  officialWeight: number;
  effectiveWeight: number;
  score: number | null;
  status: ScoreFactorStatus;
  explanation: string;
};

export type TransitionScore = {
  finalScore: number | null;
  confidence: number;
  label: "Excelente" | "Boa" | "Atenção" | "Fraca" | "Dados insuficientes";
  tone: "emerald" | "cyan" | "amber" | "rose" | "slate";
  factors: ScoreFactor[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseCamelot(musicalKey: string | null | undefined): CamelotKey | null {
  if (!musicalKey) {
    return null;
  }

  const normalized = musicalKey.trim().toUpperCase();
  const match = normalized.match(/^([1-9]|1[0-2])(A|B)$/);

  if (!match) {
    return null;
  }

  return {
    number: Number(match[1]),
    letter: match[2] as "A" | "B",
  };
}

function circularCamelotDistance(first: number, second: number) {
  const difference = Math.abs(first - second);
  return Math.min(difference, 12 - difference);
}

function getHarmonyFactor(currentTrack: ScoreTrack, nextTrack: ScoreTrack): ScoreFactor {
  const currentKey = parseCamelot(currentTrack.musical_key);
  const nextKey = parseCamelot(nextTrack.musical_key);

  if (!currentKey || !nextKey) {
    return {
      id: "harmony",
      title: "Harmonia",
      officialWeight: 16,
      effectiveWeight: 0,
      score: null,
      status: "missing",
      explanation:
        "Sem key Camelot válida nas duas tracks. A harmonia não entrou no cálculo.",
    };
  }

  if (currentKey.number === nextKey.number && currentKey.letter === nextKey.letter) {
    return {
      id: "harmony",
      title: "Harmonia",
      officialWeight: 16,
      effectiveWeight: 16,
      score: 100,
      status: "available",
      explanation: "Mesma key: encaixe harmônico direto.",
    };
  }

  if (currentKey.number === nextKey.number && currentKey.letter !== nextKey.letter) {
    return {
      id: "harmony",
      title: "Harmonia",
      officialWeight: 16,
      effectiveWeight: 16,
      score: 92,
      status: "available",
      explanation: "Relativa maior/menor: mesma numeração com A/B alternado.",
    };
  }

  const distance = circularCamelotDistance(currentKey.number, nextKey.number);

  if (distance === 1 && currentKey.letter === nextKey.letter) {
    return {
      id: "harmony",
      title: "Harmonia",
      officialWeight: 16,
      effectiveWeight: 16,
      score: 88,
      status: "available",
      explanation: "Key vizinha no Camelot: movimento harmônico próximo.",
    };
  }

  if (distance === 2 && currentKey.letter === nextKey.letter) {
    return {
      id: "harmony",
      title: "Harmonia",
      officialWeight: 16,
      effectiveWeight: 16,
      score: 70,
      status: "available",
      explanation:
        "Salto de duas posições no Camelot: possível energy boost, mas pede escuta.",
    };
  }

  return {
    id: "harmony",
    title: "Harmonia",
    officialWeight: 16,
    effectiveWeight: 16,
    score: 30,
    status: "available",
    explanation:
      "Keys distantes no Camelot. Pode funcionar com técnica ou bridge, mas exige validação.",
  };
}

function getBpmFactor(currentTrack: ScoreTrack, nextTrack: ScoreTrack): ScoreFactor {
  if (
    currentTrack.bpm === null ||
    nextTrack.bpm === null ||
    currentTrack.bpm <= 0 ||
    nextTrack.bpm <= 0
  ) {
    return {
      id: "bpm",
      title: "BPM",
      officialWeight: 7,
      effectiveWeight: 0,
      score: null,
      status: "missing",
      explanation: "Sem BPM válido nas duas tracks. O BPM não entrou no cálculo.",
    };
  }

  const directDifference =
    (Math.abs(currentTrack.bpm - nextTrack.bpm) / currentTrack.bpm) * 100;

  // Relação "mixável" de metade/dobro de tempo (comum em D&B/dubstep vs
  // house/techno na mesma pista, ex. 174 vs 87 BPM): compara também contra
  // o dobro e a metade do BPM da próxima track, não só o valor direto.
  const halfDifference =
    (Math.abs(currentTrack.bpm - nextTrack.bpm / 2) / currentTrack.bpm) * 100;
  const doubleDifference =
    (Math.abs(currentTrack.bpm - nextTrack.bpm * 2) / currentTrack.bpm) * 100;

  const bestDifference = Math.min(directDifference, halfDifference, doubleDifference);
  const isHalfDoubleRelation = bestDifference !== directDifference;

  let score = 30;
  let explanation = `Diferença de ${directDifference.toFixed(1)}% no BPM.`;

  if (bestDifference === 0) {
    score = 100;
    explanation = isHalfDoubleRelation
      ? "BPM exatamente na relação de metade/dobro (ex.: 174↔87) — mixável como tal."
      : "Mesmo BPM.";
  } else if (bestDifference <= 0.8) {
    score = 94;
    explanation = isHalfDoubleRelation
      ? "Variação praticamente imperceptível na relação de metade/dobro de BPM."
      : "Variação de BPM praticamente imperceptível.";
  } else if (bestDifference <= 1.7) {
    score = 84;
    explanation = isHalfDoubleRelation
      ? "Variação pequena na relação de metade/dobro de BPM — normalmente mixável."
      : "Variação de BPM pequena e normalmente mixável.";
  } else if (bestDifference <= 3.3) {
    score = 70;
    explanation = isHalfDoubleRelation
      ? "Relação de metade/dobro de BPM com variação perceptível, mas administrável."
      : "Mudança de BPM perceptível, mas ainda administrável.";
  } else if (bestDifference <= 5) {
    score = 55;
    explanation = "Mudança de BPM relevante: vale conferir a intenção da curva.";
  }

  return {
    id: "bpm",
    title: "BPM",
    officialWeight: 7,
    effectiveWeight: 7,
    score,
    status: "available",
    explanation,
  };
}

function getEnergyFactor(currentTrack: ScoreTrack, nextTrack: ScoreTrack): ScoreFactor {
  if (currentTrack.energy === null || nextTrack.energy === null) {
    return {
      id: "energy",
      title: "Energia",
      officialWeight: 13,
      effectiveWeight: 0,
      score: null,
      status: "missing",
      explanation:
        "Sem energia nas duas tracks. Energia não entrou no cálculo.",
    };
  }

  const difference = Math.abs(currentTrack.energy - nextTrack.energy);

  let score = 35;
  let explanation = `Diferença de ${difference} nível(is) de energia.`;

  if (difference === 0) {
    score = 100;
    explanation = "Mesmo nível de energia.";
  } else if (difference === 1) {
    score = 90;
    explanation = "Mudança de energia suave.";
  } else if (difference === 2) {
    score = 75;
    explanation = "Mudança de energia moderada.";
  } else if (difference === 3) {
    score = 58;
    explanation =
      "Mudança de energia evidente: pode ser correta se a narrativa pedir.";
  } else {
    explanation =
      "Salto forte de energia: confira se é uma mudança intencional de momento.";
  }

  return {
    id: "energy",
    title: "Energia",
    officialWeight: 13,
    effectiveWeight: 13,
    score,
    status: "available",
    explanation,
  };
}

function normalizeMood(value: string) {
  return value
    .toLowerCase()
    .split(/[,/;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getMoodFactor(currentTrack: ScoreTrack, nextTrack: ScoreTrack): ScoreFactor {
  if (!currentTrack.mood || !nextTrack.mood) {
    return {
      id: "mood",
      title: "Textura e mood",
      officialWeight: 9,
      effectiveWeight: 0,
      score: null,
      status: "missing",
      explanation:
        "Sem mood nas duas tracks. Textura e mood não entraram no cálculo.",
    };
  }

  const currentMoods = normalizeMood(currentTrack.mood);
  const nextMoods = normalizeMood(nextTrack.mood);

  const commonMoods = currentMoods.filter((mood) => nextMoods.includes(mood));

  if (currentTrack.mood.trim().toLowerCase() === nextTrack.mood.trim().toLowerCase()) {
    return {
      id: "mood",
      title: "Textura e mood",
      officialWeight: 9,
      effectiveWeight: 9,
      score: 100,
      status: "available",
      explanation: "Mesmo mood declarado.",
    };
  }

  if (commonMoods.length > 0) {
    return {
      id: "mood",
      title: "Textura e mood",
      officialWeight: 9,
      effectiveWeight: 9,
      score: 78,
      status: "available",
      explanation: `Mood em comum: ${commonMoods.join(", ")}.`,
    };
  }

  return {
    id: "mood",
    title: "Textura e mood",
    officialWeight: 9,
    effectiveWeight: 9,
    score: 52,
    status: "available",
    explanation:
      "Moods diferentes. Pode ser uma troca de paleta desejada ou pedir uma bridge.",
  };
}

function getDiversityFactor(currentTrack: ScoreTrack, nextTrack: ScoreTrack): ScoreFactor {
  if (!currentTrack.artist || !nextTrack.artist) {
    return {
      id: "diversity",
      title: "Diversidade",
      officialWeight: 5,
      effectiveWeight: 0,
      score: null,
      status: "missing",
      explanation:
        "Sem artista nas duas tracks. Diversidade não entrou no cálculo.",
    };
  }

  const isSameArtist =
    currentTrack.artist.trim().toLowerCase() === nextTrack.artist.trim().toLowerCase();

  if (isSameArtist) {
    return {
      id: "diversity",
      title: "Diversidade",
      officialWeight: 5,
      effectiveWeight: 5,
      score: 35,
      status: "available",
      explanation:
        "Mesmo artista em sequência. Não bloqueia a transição, mas reduz diversidade.",
    };
  }

  return {
    id: "diversity",
    title: "Diversidade",
    officialWeight: 5,
    effectiveWeight: 5,
    score: 100,
    status: "available",
    explanation: "Artistas diferentes em sequência.",
  };
}

function getMomentLabel(moment: CuratorialMoment) {
  const labels: Record<CuratorialMoment, string> = {
    opening: "abertura",
    build: "construção",
    valley: "vale",
    peak: "pico",
    contemplation: "contemplação",
    closing: "encerramento",
  };

  return labels[moment];
}

function getNarrativeFactor(
  currentContext: ScoreTracklistItemContext | null | undefined,
  nextContext: ScoreTracklistItemContext | null | undefined
): ScoreFactor {
  const currentMoment = currentContext?.curatorial_moment ?? null;
  const nextMoment = nextContext?.curatorial_moment ?? null;

  if (!currentMoment || !nextMoment) {
    return {
      id: "narrative",
      title: "Narrativa",
      officialWeight: 28,
      effectiveWeight: 0,
      score: null,
      status: "missing",
      explanation:
        "Sem momento curatorial nas duas tracks. Narrativa ainda não entrou no cálculo.",
    };
  }

  const narrativeScores: Record<
    CuratorialMoment,
    Partial<Record<CuratorialMoment, number>>
  > = {
    opening: {
      opening: 88,
      build: 96,
      valley: 55,
      contemplation: 68,
      peak: 30,
      closing: 20,
    },
    build: {
      opening: 35,
      build: 86,
      valley: 62,
      contemplation: 58,
      peak: 95,
      closing: 28,
    },
    valley: {
      opening: 42,
      build: 84,
      valley: 80,
      contemplation: 90,
      peak: 52,
      closing: 40,
    },
    peak: {
      opening: 18,
      build: 40,
      valley: 82,
      contemplation: 72,
      peak: 78,
      closing: 60,
    },
    contemplation: {
      opening: 40,
      build: 74,
      valley: 88,
      contemplation: 84,
      peak: 46,
      closing: 92,
    },
    closing: {
      opening: 12,
      build: 18,
      valley: 40,
      contemplation: 62,
      peak: 22,
      closing: 96,
    },
  };

  const score = narrativeScores[currentMoment][nextMoment] ?? 40;

  return {
    id: "narrative",
    title: "Narrativa",
    officialWeight: 28,
    effectiveWeight: 28,
    score,
    status: "available",
    explanation: `Transição de ${getMomentLabel(currentMoment)} para ${getMomentLabel(nextMoment)}.`,
  };
}

function getTimingFactor(
  currentContext: ScoreTracklistItemContext | null | undefined,
  nextContext: ScoreTracklistItemContext | null | undefined
): ScoreFactor {
  const currentMoment = currentContext?.curatorial_moment ?? null;
  const nextMoment = nextContext?.curatorial_moment ?? null;

  if (!currentMoment || !nextMoment) {
    return {
      id: "timing",
      title: "Momento da track",
      officialWeight: 22,
      effectiveWeight: 0,
      score: null,
      status: "missing",
      explanation:
        "Sem momento curatorial nas duas tracks. O momento da track ainda não entrou no cálculo.",
    };
  }

  if (currentMoment === nextMoment) {
    return {
      id: "timing",
      title: "Momento da track",
      officialWeight: 22,
      effectiveWeight: 22,
      score: 88,
      status: "available",
      explanation: "As duas tracks ocupam o mesmo momento curatorial.",
    };
  }

  const strongPairs = new Set([
    "opening:build",
    "build:peak",
    "peak:valley",
    "valley:contemplation",
    "contemplation:closing",
    "valley:build",
    "build:valley",
    "peak:contemplation",
  ]);

  const pair = `${currentMoment}:${nextMoment}`;

  if (strongPairs.has(pair)) {
    return {
      id: "timing",
      title: "Momento da track",
      officialWeight: 22,
      effectiveWeight: 22,
      score: 92,
      status: "available",
      explanation: `Boa relação de momento: ${getMomentLabel(currentMoment)} para ${getMomentLabel(nextMoment)}.`,
    };
  }

  return {
    id: "timing",
    title: "Momento da track",
    officialWeight: 22,
    effectiveWeight: 22,
    score: 52,
    status: "available",
    explanation: `Mudança de momento menos previsível: ${getMomentLabel(currentMoment)} para ${getMomentLabel(nextMoment)}.`,
  };
}

export type ScoringWeights = Partial<Record<ScoreFactor["id"], number>>;

export const DEFAULT_SCORING_WEIGHTS: Record<ScoreFactor["id"], number> = {
  narrative: 0,
  timing: 0,
  harmony: 32,
  energy: 26,
  mood: 18,
  bpm: 14,
  diversity: 10,
};

/**
 * Normaliza o JSON salvo em set_projects.scoring_weights para as chaves
 * usadas pelo motor de score. O default histórico da tabela usa "moment" e
 * "texture" (nomes do plano original do produto); o código usa "timing" e
 * "mood" (nomes dos fatores implementados). Aceita as duas grafias.
 */
export function normalizeScoringWeights(raw: unknown): ScoringWeights | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const record = raw as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return value;
      }
    }
    return undefined;
  };

  const weights: ScoringWeights = {};
  const narrative = pick("narrative");
  const timing = pick("timing", "moment");
  const harmony = pick("harmony");
  const energy = pick("energy");
  const mood = pick("mood", "texture");
  const bpm = pick("bpm");
  const diversity = pick("diversity");

  if (narrative !== undefined) weights.narrative = narrative;
  if (timing !== undefined) weights.timing = timing;
  if (harmony !== undefined) weights.harmony = harmony;
  if (energy !== undefined) weights.energy = energy;
  if (mood !== undefined) weights.mood = mood;
  if (bpm !== undefined) weights.bpm = bpm;
  if (diversity !== undefined) weights.diversity = diversity;

  return Object.keys(weights).length > 0 ? weights : undefined;
}

export function calculateTransitionScore(
  currentTrack: ScoreTrack | null | undefined,
  nextTrack: ScoreTrack | null | undefined,
  currentContext?: ScoreTracklistItemContext | null,
  nextContext?: ScoreTracklistItemContext | null,
  customWeights?: ScoringWeights
): TransitionScore | null {
  if (!currentTrack || !nextTrack) {
    return null;
  }

  const rawFactors: ScoreFactor[] = [
    getNarrativeFactor(currentContext, nextContext),
    getTimingFactor(currentContext, nextContext),
    getHarmonyFactor(currentTrack, nextTrack),
    getEnergyFactor(currentTrack, nextTrack),
    getMoodFactor(currentTrack, nextTrack),
    getBpmFactor(currentTrack, nextTrack),
    getDiversityFactor(currentTrack, nextTrack),
  ];

  // Peso efetivo de cada fator: DEFAULT_SCORING_WEIGHTS é a única fonte de
  // verdade dos pesos-padrão, sobrescrita por customWeights quando o
  // projeto tiver pesos salvos. O officialWeight retornado por cada
  // getXFactor (28/22/16/13/9/7/5 do plano original) é só um placeholder
  // interno — sempre substituído aqui, nunca usado como peso de fato. Antes
  // esse merge só rodava quando customWeights existia; mudar
  // DEFAULT_SCORING_WEIGHTS sozinho não tinha nenhum efeito real no cálculo
  // pra projetos sem peso salvo, porque caíam direto no officialWeight
  // hardcoded de cada função — bug latente, não só uma limpeza cosmética.
  const effectiveWeights: Record<ScoreFactor["id"], number> = {
    ...DEFAULT_SCORING_WEIGHTS,
    ...customWeights,
  };

  const factors: ScoreFactor[] = rawFactors.map((factor) => {
    const weight = effectiveWeights[factor.id];
    return {
      ...factor,
      officialWeight: weight,
      effectiveWeight: factor.status === "available" ? weight : 0,
    };
  });

  const availableFactors = factors.filter(
    (factor) => factor.status === "available" && factor.score !== null
  );

  const usedWeight = availableFactors.reduce(
    (sum, factor) => sum + factor.officialWeight,
    0
  );

  const totalOfficialWeight = factors.reduce(
    (sum, factor) => sum + factor.officialWeight,
    0
  );

  if (usedWeight === 0) {
    return {
      finalScore: null,
      confidence: 0,
      label: "Dados insuficientes",
      tone: "slate",
      factors,
    };
  }

  const weightedScore = availableFactors.reduce((sum, factor) => {
    return sum + (factor.score ?? 0) * factor.officialWeight;
  }, 0);

  const finalScore = clampScore(weightedScore / usedWeight);
  const confidence = clampScore((usedWeight / totalOfficialWeight) * 100);

  let label: TransitionScore["label"] = "Fraca";
  let tone: TransitionScore["tone"] = "rose";

  if (finalScore >= 85) {
    label = "Excelente";
    tone = "emerald";
  } else if (finalScore >= 70) {
    label = "Boa";
    tone = "cyan";
  } else if (finalScore >= 55) {
    label = "Atenção";
    tone = "amber";
  }

  return {
    finalScore,
    confidence,
    label,
    tone,
    factors,
  };
}

export type MatchDirection = "after" | "before";

export type TrackMatch = {
  track: ScoreTrack;
  score: TransitionScore;
  /**
   * "after": a track do match entra DEPOIS do alvo (target -> track).
   * "before": a track do match entra ANTES do alvo (track -> target).
   * Reflete o parâmetro `direction` pedido a rankTrackMatches — todo
   * match de uma mesma chamada tem a mesma direção, são duas perguntas
   * distintas ("o que combina depois desta track" vs "o que combina
   * antes desta track"), não uma mistura automática das duas.
   */
  direction: MatchDirection;
};

/**
 * Critério de desempate/reordenação por tendência de energia — não entra
 * no score exibido (que continua sendo o calculateTransitionScore puro,
 * pra bater com o que aparece em qualquer TransitionScoreCard do app).
 *
 * Motivo de existir: sem contexto narrativo, harmonia (distância circular
 * no Camelot), mood e diversidade são simétricas por natureza — a
 * compatibilidade entre A e B não tem "lado". Energia usa Math.abs (também
 * simétrica) e BPM tem uma assimetria residual pequena demais pra mudar de
 * faixa na maioria dos casos. Resultado prático: calculateTransitionScore
 * (A,B) e (B,A) davam quase sempre o mesmo número, e "toca depois"/"toca
 * antes" mostravam praticamente a mesma lista na mesma ordem — as duas
 * perguntas eram diferentes só na teoria.
 *
 * Esse bônus/penalidade quebra o empate favorecendo a tendência esperada:
 * "after" prefere manter ou subir energia (like um set costuma evoluir);
 * "before" prefere manter ou descer (a track anterior conduz até o alvo).
 * É um viés de ORDENAÇÃO, não um filtro — nenhuma track é escondida, uma
 * queda de energia deliberada ainda aparece se o score dela for realmente
 * melhor. A magnitude (±4 pontos por nível de energia, escala 1-10) foi
 * calibrada empiricamente: testei ±2/±3/±4/±5 contra 300 tracks
 * sintéticas — ±4 reduz a sobreposição entre as duas listas de 55% (±2)
 * pra ~15%, sem empurrar a energia média pro teto/piso da escala como
 * ±5 fazia (sinal de que estava virando filtro por energia disfarçado de
 * score).
 */
function energyTrendBias(
  target: ScoreTrack,
  candidate: ScoreTrack,
  direction: MatchDirection
): number {
  if (target.energy == null || candidate.energy == null) return 0;

  const diff =
    direction === "after"
      ? candidate.energy - target.energy
      : target.energy - candidate.energy;

  return diff * 4;
}

/**
 * Rankeia as tracks de `pool` pela compatibilidade com `target` NUM
 * SENTIDO ESPECÍFICO — usando o mesmo cálculo de score exibido em
 * qualquer transição da tracklist, sem contexto curatorial (não faz
 * sentido fora de uma tracklist real: não há "momento no set" pra uma
 * pergunta genérica de "o que combina com essa track").
 *
 * `direction: "after"` responde "o que soa bem TOCANDO DEPOIS de
 * `target`" (score de target -> candidata). `direction: "before"`
 * responde "o que soa bem TOCANDO ANTES de `target`" (score de
 * candidata -> target). São duas perguntas diferentes — o score de cada
 * uma é calculado separadamente, mas como fica pouca coisa direcional na
 * equação sem contexto narrativo, o desempate usa tendência de energia
 * (ver energyTrendBias) pra garantir que as duas listas de fato divirjam,
 * não só na teoria.
 */
export function rankTrackMatches(
  target: ScoreTrack,
  pool: ScoreTrack[],
  weights?: ScoringWeights,
  limit = 12,
  direction: MatchDirection = "after"
): TrackMatch[] {
  const results: TrackMatch[] = [];
  const targetKey = makeTrackKey(target.title, target.artist ?? "");

  for (const candidate of pool) {
    // Duas camadas de exclusão: por id (a própria linha) e por identidade
    // normalizada (título+artista, mesma lógica usada pra dedup no import
    // de CSV) — cobre o caso de uma "gêmea" quase idêntica, digitada
    // diferente ou reimportada, aparecer como "melhor match" de si mesma
    // mesmo tendo um id diferente no banco.
    if (candidate.id === target.id) continue;
    if (makeTrackKey(candidate.title, candidate.artist ?? "") === targetKey) continue;

    const score =
      direction === "after"
        ? calculateTransitionScore(target, candidate, null, null, weights)
        : calculateTransitionScore(candidate, target, null, null, weights);

    if (score?.finalScore == null) continue;

    results.push({ track: candidate, score, direction });
  }

  results.sort((a, b) => {
    const rankA = (a.score.finalScore ?? 0) + energyTrendBias(target, a.track, direction);
    const rankB = (b.score.finalScore ?? 0) + energyTrendBias(target, b.track, direction);
    return rankB - rankA;
  });

  return results.slice(0, limit);
}