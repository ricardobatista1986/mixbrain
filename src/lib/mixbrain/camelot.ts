import type { ScoreTrack } from "./transition-score";

export type HarmonicRelation =
  | "perfect_match"
  | "scale_change"
  | "perfect_boost"
  | "perfect_drop"
  | "energy_boost"
  | "diagonal_mix"
  | "mood_change"
  | "jaws_mix"
  | "incompatible"
  | "missing_data";

export type HarmonicRelationMeta = {
  icon: string;
  label: string;
  description: string;
};

/**
 * As 8 categorias nomeadas seguem a documentação oficial do DJ.Studio
 * (help.dj.studio/en/articles/8118455-harmonic-matches-explained,
 * consultada em 2026-08-24) mais uma 9ª categoria "incompatível" (o "X"
 * que o DJ.Studio mostra pra qualquer relação fora das 8). A distância
 * `d` é a diferença assinada de menor caminho no número Camelot (-6..+6);
 * cada passo de 1 no número (mesma letra) equivale a uma quinta justa
 * (círculo de quintas), então:
 *   d=+1 mesma letra = quinta justa acima (Perfect Boost)
 *   d=-1 mesma letra = quarta justa acima / quinta abaixo (Perfect Drop)
 *   d=+2 mesma letra = tom inteiro acima (Energy Boost)
 *   d=0  letra diferente = relativa maior/menor (Scale Change)
 *   d=±1 letra diferente = quarta/quinta + troca de relativa (Diagonal Mix)
 *   d=±3 letra diferente = maior/menor paralela, mesma tônica (Mood Change)
 *   d=±5 mesma letra = semitom (intervalo do tema de Jaws) (Jaw's Mix)
 * Qualquer combinação fora dessas -> incompatível.
 *
 * IMPORTANTE: implementado a partir da documentação pública do DJ.Studio
 * e da teoria padrão do Camelot Wheel (círculo de quintas), não a partir
 * do camelot.py que já foi validado empiricamente contra o DJ.Studio em
 * sessão anterior (esse arquivo não estava acessível aqui). Vale
 * conferir os casos de borda (Diagonal Mix, Mood Change, Jaw's Mix)
 * contra esse arquivo se ele estiver à mão.
 */
export const HARMONIC_RELATION_META: Record<HarmonicRelation, HarmonicRelationMeta> = {
  perfect_match: {
    icon: "🎯",
    label: "Match perfeito",
    description: "Mesma key exata. A transição mais segura possível.",
  },
  perfect_boost: {
    icon: "⬆️",
    label: "Boost perfeito",
    description: "Sobe uma quinta justa — energia sobe com risco quase zero.",
  },
  perfect_drop: {
    icon: "⬇️",
    label: "Drop perfeito",
    description: "Desce uma quarta justa — energia desce com risco quase zero.",
  },
  energy_boost: {
    icon: "⚡",
    label: "Energy boost",
    description: "Sobe um tom inteiro — salto mais perceptível, mas ainda funciona.",
  },
  scale_change: {
    icon: "🔄",
    label: "Troca de escala",
    description: "Vai pra relativa maior/menor — muda o clima sem tensão harmônica.",
  },
  diagonal_mix: {
    icon: "🔀",
    label: "Mix diagonal",
    description: "Quarta/quinta combinada com troca de relativa — mix mais arriscado.",
  },
  mood_change: {
    icon: "🌓",
    label: "Troca de clima",
    description: "Vai pra maior/menor paralela (mesma tônica) — mudança de clima acentuada.",
  },
  jaws_mix: {
    icon: "🦈",
    label: "Mix dissonante",
    description: "Semitom de distância — o intervalo do tema de Jaws. Dissonante, uso deliberado.",
  },
  incompatible: {
    icon: "❌",
    label: "Incompatível",
    description: "Fora das relações harmônicas seguras do Camelot Wheel.",
  },
  missing_data: {
    icon: "➖",
    label: "Sem key",
    description: "Uma das duas tracks não tem key Camelot válida.",
  },
};

type CamelotKey = { number: number; letter: "A" | "B" };

function parseCamelot(musicalKey: string | null | undefined): CamelotKey | null {
  if (!musicalKey) return null;
  const normalized = musicalKey.trim().toUpperCase();
  const match = normalized.match(/^([1-9]|1[0-2])(A|B)$/);
  if (!match) return null;
  return { number: Number(match[1]), letter: match[2] as "A" | "B" };
}

/** Diferença assinada de menor caminho entre dois números Camelot (-6..+6). */
function signedCamelotDistance(from: number, to: number): number {
  let diff = (to - from) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

export function classifyHarmonicRelation(
  currentKey: string | null | undefined,
  nextKey: string | null | undefined
): HarmonicRelation {
  const current = parseCamelot(currentKey);
  const next = parseCamelot(nextKey);

  if (!current || !next) return "missing_data";

  const d = signedCamelotDistance(current.number, next.number);
  const sameLetter = current.letter === next.letter;

  if (d === 0 && sameLetter) return "perfect_match";
  if (d === 0 && !sameLetter) return "scale_change";
  if (d === 1 && sameLetter) return "perfect_boost";
  if (d === -1 && sameLetter) return "perfect_drop";
  if (d === 2 && sameLetter) return "energy_boost";
  if (Math.abs(d) === 1 && !sameLetter) return "diagonal_mix";
  if (Math.abs(d) === 3 && !sameLetter) return "mood_change";
  if (Math.abs(d) === 5 && sameLetter) return "jaws_mix";

  return "incompatible";
}

export type EnergyDirection = "rise" | "drop" | "stable" | "missing_data";

export const ENERGY_DIRECTION_META: Record<
  EnergyDirection,
  { icon: string; label: string }
> = {
  rise: { icon: "📈", label: "Energia sobe" },
  drop: { icon: "📉", label: "Energia cai" },
  stable: { icon: "➡️", label: "Energia estável" },
  missing_data: { icon: "➖", label: "Sem energia" },
};

/** Limiar de 2 pontos (escala 1-10) pra considerar subida/queda perceptível — abaixo disso, "estável". */
const ENERGY_STABLE_THRESHOLD = 2;

export function classifyEnergyDirection(
  currentEnergy: number | null | undefined,
  nextEnergy: number | null | undefined
): EnergyDirection {
  if (currentEnergy == null || nextEnergy == null) return "missing_data";
  const diff = nextEnergy - currentEnergy;
  if (Math.abs(diff) < ENERGY_STABLE_THRESHOLD) return "stable";
  return diff > 0 ? "rise" : "drop";
}

export function getHarmonicRelationForTracks(
  currentTrack: ScoreTrack | null | undefined,
  nextTrack: ScoreTrack | null | undefined
): HarmonicRelation {
  if (!currentTrack || !nextTrack) return "missing_data";
  return classifyHarmonicRelation(currentTrack.musical_key, nextTrack.musical_key);
}

export function getEnergyDirectionForTracks(
  currentTrack: ScoreTrack | null | undefined,
  nextTrack: ScoreTrack | null | undefined
): EnergyDirection {
  if (!currentTrack || !nextTrack) return "missing_data";
  return classifyEnergyDirection(currentTrack.energy, nextTrack.energy);
}
