import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SCORING_WEIGHTS, normalizeScoringWeights } from "@/lib/mixbrain/transition-score";
import { HARMONIC_RELATION_META, ENERGY_DIRECTION_META } from "@/lib/mixbrain/camelot";

const HARMONIC_RELATION_ORDER: (keyof typeof HARMONIC_RELATION_META)[] = [
  "perfect_match",
  "perfect_boost",
  "perfect_drop",
  "energy_boost",
  "scale_change",
  "diagonal_mix",
  "mood_change",
  "jaws_mix",
  "incompatible",
  "missing_data",
];

const ENERGY_DIRECTION_ORDER: (keyof typeof ENERGY_DIRECTION_META)[] = [
  "rise",
  "drop",
  "stable",
  "missing_data",
];

const FACTOR_META: Record<
  keyof typeof DEFAULT_SCORING_WEIGHTS,
  {
    title: string;
    description: string;
    example: string;
    color: string;
  }
> = {
  harmony: {
    title: "Harmonia",
    description:
      "Usa key musical e Camelot para estimar compatibilidade tonal entre duas tracks. É um sinal importante, mas não manda sozinho na ordem.",
    example:
      "10B para 9A é uma relação próxima — uma das transições mais seguras do Camelot Wheel.",
    color: "border-violet-300/30 bg-violet-300/10 text-violet-100",
  },
  energy: {
    title: "Energia",
    description:
      "Compara o nível de energia (1-10) entre as duas tracks para evitar saltos sem intenção.",
    example:
      "Diferença de 1 nível recebe score alto; um salto de 4+ níveis pede atenção — pode ser deliberado, mas vale conferir.",
    color: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100",
  },
  mood: {
    title: "Textura e mood",
    description:
      "Compara as tags de mood declaradas nas duas tracks (texto livre) para evitar mudanças bruscas de paleta sonora.",
    example:
      "Duas tracks com BPM e key semelhantes podem precisar de uma bridge se uma é introspectiva e a próxima é muito expansiva.",
    color: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  },
  bpm: {
    title: "BPM",
    description:
      "Mede a diferença percentual de BPM. O valor pode ser menor em importância porque a mudança de BPM pode ser deliberada e mixável (inclusive relações de metade/dobro de tempo, tratadas como compatíveis).",
    example:
      "122 para 122 recebe compatibilidade alta; uma variação maior pode ser aceita quando a mudança de tempo é deliberada.",
    color: "border-lime-300/30 bg-lime-300/10 text-lime-100",
  },
  diversity: {
    title: "Diversidade",
    description:
      "Reduz o risco de repetição excessiva de um mesmo artista em sequência, mas não impede repetições intencionais.",
    example:
      "Uma segunda track do mesmo artista pode entrar se for indispensável ou funcionar como bridge.",
    color: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  },
  vocal_texture: {
    title: "Textura vocal",
    description:
      "Combina instrumentalness e speechiness (dados do Spotify) para comparar presença vocal entre as duas tracks — evita colidir uma track muito falada/cantada com uma puramente instrumental.",
    example:
      "Um instrumental puro seguido de uma track com vocal denso pode soar como um contraste brusco, mesmo com harmonia e BPM perfeitos.",
    color: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  },
  groove_mood: {
    title: "Groove e clima",
    description:
      "Combina danceability e valence (dados do Spotify) para comparar dançabilidade e positividade musical entre as duas tracks — um sinal quantitativo que complementa o mood em texto livre.",
    example:
      "Duas tracks com o mesmo BPM podem ter groove bem diferente — uma mais dançante e eufórica, outra mais introspectiva.",
    color: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
  },
};

const FACTOR_ORDER: (keyof typeof DEFAULT_SCORING_WEIGHTS)[] = [
  "harmony",
  "energy",
  "mood",
  "bpm",
  "diversity",
  "vocal_texture",
  "groove_mood",
];

const dimensions = [
  ["Energia", "Intensidade geral percebida na track."],
  ["Intensidade de pista", "Quanto a track impulsiona movimento e dança."],
  ["Tensão", "Antecipação, pressão, inquietação ou sensação de subida."],
  ["Hipnose", "Capacidade de sustentar imersão por repetição e atmosfera."],
  ["Emoção", "Carga afetiva, melancolia, catarse ou sensibilidade."],
  ["Melodia", "Quanto elementos melódicos dominam a experiência."],
  ["Vocal", "Presença e protagonismo de voz."],
  ["Brilho", "Sensação de abertura, luz, calor ou expansão."],
  ["Groove", "Balanço, swing e convite rítmico ao movimento."],
  ["Agressividade", "Dureza, aspereza, pressão ou frontalidade sonora."],
  ["Escuridão", "Sensação noturna, introspectiva, densa ou pesada."],
];

const rules = [
  {
    title: "Score não decide sozinho",
    text: "O score é uma recomendação explicada. Você continua aprovando, rejeitando, movendo e fixando tracks.",
  },
  {
    title: "Dados têm confiança",
    text: "BPM, key, energia e demais atributos informam fonte e confiança. Dados ausentes não bloqueiam uma track, mas reduzem a confiança da sugestão.",
  },
  {
    title: "Reserva não é exclusão",
    text: "Uma track em reserva continua guardada dentro do set e pode voltar a qualquer momento.",
  },
  {
    title: "Bloco congelado é movível",
    text: "As tracks internas não mudam de ordem e não recebem inserções ou remoções. Porém, o bloco inteiro pode mudar de posição como uma única unidade.",
  },
  {
    title: "Bridge resolve uma lacuna",
    text: "Bridge não é apenas compatibilidade de BPM ou key: é uma track que liga duas intenções narrativas que ainda soam desconectadas.",
  },
];

export default async function GlossarioPage({
  searchParams,
}: {
  searchParams: Promise<{ projeto?: string }>;
}) {
  const { projeto: projectId } = await searchParams;

  let projectName: string | null = null;
  let weights: Record<keyof typeof DEFAULT_SCORING_WEIGHTS, number> = DEFAULT_SCORING_WEIGHTS;
  let isCustom = false;

  if (projectId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: project } = await supabase
        .from("set_projects")
        .select("name, scoring_weights")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (project) {
        projectName = project.name;
        const normalized = normalizeScoringWeights(project.scoring_weights);
        if (normalized) {
          isCustom = true;
          weights = { ...DEFAULT_SCORING_WEIGHTS, ...normalized };
        }
      }
    }
  }

  const totalWeight = FACTOR_ORDER.reduce((sum, key) => sum + (weights[key] ?? 0), 0);
  const scoreFactors = FACTOR_ORDER.map((key) => {
    const rawWeight = weights[key] ?? 0;
    const normalizedPercent = totalWeight > 0 ? (rawWeight / totalWeight) * 100 : 0;
    return {
      key,
      weight: `${Math.round(normalizedPercent)}%`,
      ...FACTOR_META[key],
    };
  });

  return (
    <main className="min-h-screen bg-claude-bg text-claude-text">
      <header className="border-b border-claude-border bg-claude-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 sm:px-10 lg:px-12">
          <Link
            href="/"
            className="flex items-center gap-3 transition hover:opacity-80"
          >
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-claude-accent font-black text-claude-bg">
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MixBrain</p>
              <p className="text-xs text-claude-text-muted">Glossário do produto</p>
            </div>
          </Link>

          <Link
            href={projectId ? `/app/projetos/${projectId}` : "/"}
            className="rounded-full border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted transition hover:border-claude-accent/50 hover:text-claude-accent-hover"
          >
            {projectId ? "Voltar ao projeto" : "Voltar ao início"}
          </Link>
        </div>
      </header>

      <section className="border-b border-claude-border bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.16),_transparent_40%)]">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
            Transparência do modelo
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">
            Como o MixBrain lê uma transição — e onde você continua decidindo.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-claude-text-muted">
            Esta página explica pesos, dimensões, alertas e regras operacionais.
            Ela é acessível de dentro das telas que exibem um score ou uma
            recomendação.
          </p>

          {projectId ? (
            isCustom ? (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-claude-accent/40 bg-claude-accent/10 px-4 py-2 text-sm font-semibold text-claude-accent-hover">
                Mostrando os pesos personalizados do projeto
                {projectName ? ` "${projectName}"` : ""} — não os padrões
                abaixo.
              </p>
            ) : (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-claude-border bg-claude-surface px-4 py-2 text-sm text-claude-text-muted">
                {projectName ? `O projeto "${projectName}"` : "Este projeto"}{" "}
                ainda usa os pesos padrão (nenhuma personalização salva).
              </p>
            )
          ) : (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-claude-border bg-claude-surface px-4 py-2 text-sm text-claude-text-muted">
              Mostrando os pesos padrão. Cada projeto pode ajustar esses pesos
              individualmente — acesse o glossário de dentro de um projeto
              para ver os pesos que estão valendo ali.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
            Score de transição
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">
            O que forma uma recomendação
          </h2>
          <p className="mt-4 leading-7 text-claude-text-muted">
            {isCustom
              ? "Para cada relação entre track A e track B, o sistema combina estes fatores usando os pesos personalizados deste projeto."
              : "Para cada relação entre track A e track B, o sistema combina estes fatores. Os pesos abaixo são o padrão inicial e podem ser ajustados por projeto no painel de curadoria."}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {scoreFactors.map((factor) => (
            <article
              key={factor.title}
              className={`rounded-2xl border p-6 ${factor.color}`}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-bold">{factor.title}</h3>
                <span className="rounded-full bg-claude-surface/30 px-3 py-1 text-sm font-black">
                  {factor.weight}
                </span>
              </div>
              <p className="mt-4 leading-7 opacity-90">{factor.description}</p>
              <div className="mt-5 rounded-xl bg-claude-surface/25 p-4 text-sm leading-6">
                <span className="font-bold">Exemplo: </span>
                {factor.example}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-claude-border bg-claude-surface/50">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
              Dimensões narrativas
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Energia não é um único número.
            </h2>
            <p className="mt-4 leading-7 text-claude-text-muted">
              O score geral continua útil, mas o MixBrain separa características
              que podem puxar uma track em direções diferentes.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dimensions.map(([name, description], index) => (
              <article
                key={name}
                className="rounded-xl border border-claude-border bg-claude-surface p-4"
              >
                <p className="text-xs font-black text-claude-accent">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-3 font-bold">{name}</h3>
                <p className="mt-2 text-sm leading-6 text-claude-text-muted">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="relacoes-harmonicas" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-16 sm:px-10 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
            Ícones de cada transição
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">
            Relação harmônica e direção de energia
          </h2>
          <p className="mt-4 leading-7 text-claude-text-muted">
            Cada transição na tracklist mostra dois ícones: a relação harmônica
            entre as keys (baseada no Camelot Wheel) e a direção da energia. São
            só um resumo visual — o score continua sendo calculado pelos 7
            fatores acima, esses ícones só ajudam a ler a evolução do set num
            relance sem abrir cada card.
          </p>
          <p className="mt-3 text-xs leading-6 text-claude-text-faint">
            As 8 categorias harmônicas seguem a documentação oficial do
            DJ.Studio (Harmonize/Automix), cada uma um intervalo musical exato
            no círculo de quintas — não são uma aproximação visual.
          </p>
        </div>

        <div className="mt-10">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-claude-text-muted">
            Relação harmônica (key)
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {HARMONIC_RELATION_ORDER.map((key) => {
              const meta = HARMONIC_RELATION_META[key];
              return (
                <article
                  key={key}
                  className="flex items-start gap-3 rounded-xl border border-claude-border bg-claude-surface p-4"
                >
                  <span className="text-xl leading-none">{meta.icon}</span>
                  <div>
                    <p className="font-bold">{meta.label}</p>
                    <p className="mt-1 text-sm leading-6 text-claude-text-muted">
                      {meta.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-10">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-claude-text-muted">
            Direção de energia
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ENERGY_DIRECTION_ORDER.map((key) => {
              const meta = ENERGY_DIRECTION_META[key];
              return (
                <article
                  key={key}
                  className="flex items-center gap-3 rounded-xl border border-claude-border bg-claude-surface p-4"
                >
                  <span className="text-xl leading-none">{meta.icon}</span>
                  <p className="font-bold">{meta.label}</p>
                </article>
              );
            })}
          </div>
          <p className="mt-4 text-xs leading-6 text-claude-text-faint">
            Limiar de 2 pontos (escala 1–10): variações menores que isso contam
            como estável, pra não marcar toda variação natural de energia como
            subida ou queda.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent">
            Regras operacionais
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">
            Proteções para a sua curadoria.
          </h2>
        </div>

        <div className="mt-10 space-y-4">
          {rules.map((rule, index) => (
            <article
              key={rule.title}
              className="grid gap-4 rounded-2xl border border-claude-border bg-claude-surface p-5 sm:grid-cols-[3rem_1fr] sm:p-6"
            >
              <p className="text-2xl font-black text-claude-accent">
                {String(index + 1).padStart(2, "0")}
              </p>
              <div>
                <h3 className="text-lg font-bold">{rule.title}</h3>
                <p className="mt-2 leading-7 text-claude-text-muted">{rule.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-claude-border px-6 py-8 text-center text-sm text-claude-text-faint">
        MixBrain — curadoria narrativa, explicável e sob seu controle.
      </footer>
    </main>
  );
}