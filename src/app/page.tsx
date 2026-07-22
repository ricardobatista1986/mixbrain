import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  const isAuthenticated = !!claims;

  const features = [
    {
      number: "01",
      title: "Biblioteca de tracks",
      description:
        "Cadastre todas as suas tracks com BPM, tonalidade, energia, mood e observações. Um catálogo pessoal sempre à mão.",
    },
    {
      number: "02",
      title: "Projetos de set",
      description:
        "Crie projetos com duração alvo, faixa de BPM e direção narrativa. Cada projeto é um container para curadoria e experimentação.",
    },
    {
      number: "03",
      title: "Candidatas",
      description:
        "Selecione tracks da biblioteca como candidatas para cada projeto. Adicione observações específicas sobre por que aquela faixa entrou.",
    },
    {
      number: "04",
      title: "Curadoria e seleção",
      description:
        "Aprove, rejeite ou mantenha candidatas. Sem limite de tracks por projeto — o catálogo cresce na direção que você quiser.",
    },
    {
      number: "05",
      title: "Blocos e versões",
      description:
        "Mova blocos dentro da tracklist sem alterar a ordem das faixas. Salve versões de set e preserve trechos já aprovados como blocos congelados.",
    },
    {
      number: "06",
      title: "Scores e exemplos",
      description:
        "Tod as as descrições e exemplos de scoring disponíveis no site, para você entender e refinar a curadoria de cada set.",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* HERO */}
      <section className="relative overflow-hidden px-6 py-20 sm:px-10 sm:py-32">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-300/5 via-slate-950 to-violet-500/5" />

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-8 flex justify-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cyan-300 text-3xl font-black text-slate-950">
              M
            </div>
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Curadoria inteligente
          </p>

          <h1 className="mt-4 text-5xl font-black tracking-tight sm:text-7xl">
            MixBrain
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
            Plataforma para DJs e produtores de música eletrônica que querem
            organizar, curar e estruturar sets com rigor. Cadastre sua
            biblioteca, crie projetos com direção narrativa, selecione
            candidatas e monte versões de set com blocos congelados.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {isAuthenticated ? (
              <Link
                href="/app"
                className="rounded-xl bg-cyan-300 px-8 py-3 text-base font-bold text-slate-950 transition hover:bg-cyan-200"
              >
                Entrar no workspace
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-cyan-300 px-8 py-3 text-base font-bold text-slate-950 transition hover:bg-cyan-200"
              >
                Fazer login
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-t border-white/10 px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
            O que o MixBrain faz
          </p>

          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
            Do catálogo ao set final
          </h2>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
            MixBrain cobre todo o fluxo: desde o cadastro individual de cada
            faixa até a montagem e versionamento de sets completos.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.number}
                className="rounded-2xl border border-white/10 bg-slate-900/70 p-6"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  {feature.number}
                </p>
                <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-100">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="border-t border-white/10 px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            Pronto para começar?
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-400">
            Entre no workspace e crie seu primeiro projeto de set.
          </p>

          <div className="mt-8">
            {isAuthenticated ? (
              <Link
                href="/app"
                className="inline-block rounded-xl bg-cyan-300 px-8 py-3 text-base font-bold text-slate-950 transition hover:bg-cyan-200"
              >
                Entrar no workspace
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-block rounded-xl bg-cyan-300 px-8 py-3 text-base font-bold text-slate-950 transition hover:bg-cyan-200"
              >
                Fazer login
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}