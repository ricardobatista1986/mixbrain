export type ScoreTrack = {
  id: string;
  title: string;
  artist: string | null;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
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
  tone:
    | "emerald"
    | "cyan"
    | "amber"
    | "rose"
    | "slate";
  factors: ScoreFactor[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseCamelot(
  musicalKey: string | null | undefined
): CamelotKey | null {
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

function getHarmonyFactor(
  currentTrack: ScoreTrack,
  nextTrack: ScoreTrack
): ScoreFactor {
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

  if (
    currentKey.number === nextKey.number &&
    currentKey.letter === nextKey.letter
  ) {
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

  if (
    currentKey.number === nextKey.number &&
    currentKey.letter !== nextKey.letter
  ) {
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

  const distance = circularCamelotDistance(
    currentKey.number,
    nextKey.number
  );

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

function getBpmFactor(
  currentTrack: ScoreTrack,
  nextTrack: ScoreTrack
): ScoreFactor {
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

  const percentageDifference =
    (Math.abs(currentTrack.bpm - nextTrack.bpm) / currentTrack.bpm) * 100;

  let score = 30;
  let explanation = `Diferença de ${percentageDifference.toFixed(1)}% no BPM.`;

  if (percentageDifference === 0) {
    score = 100;
    explanation = "Mesmo BPM.";
  } else if (percentageDifference <= 0.8) {
    score = 94;
    explanation = "Variação de BPM praticamente imperceptível.";
  } else if (percentageDifference <= 1.7) {
    score = 84;
    explanation = "Variação de BPM pequena e normalmente mixável.";
  } else if (percentageDifference <= 3.3) {
    score = 70;
    explanation = "Mudança de BPM perceptível, mas ainda administrável.";
  } else if (percentageDifference <= 5) {
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

function getEnergyFactor(
  currentTrack: ScoreTrack,
  nextTrack: ScoreTrack
): ScoreFactor {
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

function getMoodFactor(
  currentTrack: ScoreTrack,
  nextTrack: ScoreTrack
): ScoreFactor {
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

  const commonMoods = currentMoods.filter((mood) =>
    nextMoods.includes(mood)
  );

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

function getDiversityFactor(
  currentTrack: ScoreTrack,
  nextTrack: ScoreTrack
): ScoreFactor {
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
    currentTrack.artist.trim().toLowerCase() ===
    nextTrack.artist.trim().toLowerCase();

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

function getPendingFactor(
  id: "narrative" | "timing",
  title: string,
  officialWeight: number,
  explanation: string
): ScoreFactor {
  return {
    id,
    title,
    officialWeight,
    effectiveWeight: 0,
    score: null,
    status: "pending",
    explanation,
  };
}

export function calculateTransitionScore(
  currentTrack: ScoreTrack | null | undefined,
  nextTrack: ScoreTrack | null | undefined
): TransitionScore | null {
  if (!currentTrack || !nextTrack) {
    return null;
  }

  const factors: ScoreFactor[] = [
    getPendingFactor(
      "narrative",
      "Narrativa",
      28,
      "Ainda depende de marcações de intenção e curva narrativa do projeto."
    ),
    getPendingFactor(
      "timing",
      "Momento da track",
      22,
      "Ainda depende de contexto curatorial: abertura, construção, vale, pico ou encerramento."
    ),
    getHarmonyFactor(currentTrack, nextTrack),
    getEnergyFactor(currentTrack, nextTrack),
    getMoodFactor(currentTrack, nextTrack),
    getBpmFactor(currentTrack, nextTrack),
    getDiversityFactor(currentTrack, nextTrack),
  ];

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