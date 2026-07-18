const modules = [
  {
    number: "01",
    title: "Importar base",
    description:
      "Receba dados do Chosic por CSV, tabela copiada ou texto delimitado, sem depender de uma integração automática.",
  },
  {
    number: "02",
    title: "Definir narrativa",
    description:
      "Transforme a história do set em uma proposta visual de energia, tensão, groove, brilho e momentos de respiro.",
  },
  {
    number: "03",
    title: "Ordenar com contexto",
    description:
      "Gere uma tracklist explicável que respeita narrativa, momento da faixa, harmonia, energia, BPM e diversidade.",
  },
  {
    number: "04",
    title: "Encontrar bridges",
    description:
      "Conecte duas tracks que fazem sentido no set, mas ainda precisam de groove, textura ou emoção entre elas.",
  },
  {
    number: "05",
    title: "Refinar sem perder",
    description:
      "Aprove transições, congele blocos movíveis, adicione candidatas e reotimize somente o que continua aberto.",
  },
];

const scoreItems = [
  { label: "Narrativa", value: 28, tone: "bg-cyan-300" },
  { label: "Momento da track", value: 22, tone: "bg-sky-400" },
  { label: "Harmonia", value: 16, tone: "bg-violet-400" },
  { label: "Energia", value: 13, tone: "bg-fuchsia-400" },
  { label: "Textura e mood", value: 9, tone: "bg-amber-300" },
  { label: "BPM", value: 7, tone: "bg-lime-300" },
  { label: "Diversidade", value: 5, tone: "bg-emerald-400" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_36%),radial-gradient(circle_at_20%_80%,_rgba(168,85,247,0.15),_transparent_34%)]" />

        <div className="relative mx-auto max-w-6xl px-6 py-8 sm:px-10 lg:px-12">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950">
                M
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight">MixBrain</p>
                <p className="text-xs text-slate-400">
                  Curadoria narrativa para DJ sets
                </p>
              </div>
            </div>

            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-200">
              Fundação v0.1
            </span>
          </nav>

          <div className="grid gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Curadoria antes da mixagem
              </p>

              <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl">
                A história do seu set merece mais do que uma ordenação por BPM.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                O MixBrain transforma uma base pré-selecionada de tracks em uma
                tracklist coerente, explicável e aberta à sua audição, seus
                locks e sua curadoria.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  Narrativa primeiro
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  Blocos movíveis
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                  Bridges explicadas
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <p className="text-sm font-medium text-slate-400">
                    Exemplo de transição
                  </p>
                  <p className="mt-1 font-semibold">
                    Alive Again{" "}
                    <span className="text-slate-500">para</span> Staring Eye
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-400/15 px-3 py-2 text-right">
                  <p className="text-xs text-emerald-200">Recomendada</p>
                  <p className="text-xl font-black text-emerald-300">84/100</p>
                </div>
              </div>

              <div className="space-y-4 py-5">
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-300">Narrativa</span>
                    <span className="font-semibold text-cyan-200">
                      Abertura contemplativa
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[84%] rounded-full bg-cyan-300" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-slate-500">Harmonia</p>
                    <p className="mt-1 font-semibold text-violet-300">
                      10B → 9A
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-slate-500">BPM</p>
                    <p className="mt-1 font-semibold text-lime-300">
                      122 → 122
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-slate-500">Energia</p>
                    <p className="mt-1 font-semibold text-fuchsia-300">
                      86 → 85
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-3">
                    <p className="text-slate-500">Confiança</p>
                    <p className="mt-1 font-semibold text-amber-200">Média</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
                <p className="text-sm font-semibold text-cyan-200">
                  Como isto funciona?
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Toda sugestão mostra os dados, pesos, riscos e a razão
                  narrativa da escolha. O score ajuda a decidir; ele não decide
                  por você.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
            O fluxo
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Da base extensa à ordem que faz sentido.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-400">
            Você continua sendo o curador final. O MixBrain organiza o trabalho
            pesado, preserva decisões aprovadas e torna cada recomendação
            verificável.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {modules.map((module) => (
            <article
              key={module.number}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.06]"
            >
              <p className="text-sm font-bold text-cyan-300">{module.number}</p>
              <h3 className="mt-8 text-lg font-bold">{module.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {module.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-900/50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 sm:px-10 lg:grid-cols-[0.85fr_1.15fr] lg:px-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Score explicável
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              Nenhuma fórmula escondida.
            </h2>
            <p className="mt-4 leading-7 text-slate-400">
              Os pesos refletem as prioridades definidas para o set: coerência
              narrativa e o momento certo da track vêm antes de BPM e repetição
              de artista.
            </p>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/60 p-6">
            {scoreItems.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="font-bold text-slate-100">
                    {item.value}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${item.tone}`}
                    style={{ width: `${item.value * 3.2}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 lg:px-12">
        <div className="rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 via-slate-900 to-violet-500/10 p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Regra do produto
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            Uma transição tecnicamente possível não é necessariamente uma
            transição certa para a história.
          </h2>
          <p className="mt-5 max-w-2xl leading-7 text-slate-300">
            BPM, Camelot e atributos ajudam. Mas o MixBrain foi desenhado para
            preservar o que importa: timing, tensão, respiro, groove e a
            sensação de que cada faixa entrou no momento inevitável.
          </p>
        </div>
      </section>
    </main>
  );
}