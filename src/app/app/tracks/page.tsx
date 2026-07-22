import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { CreateTrackForm } from "@/components/create-track-form";

function formatBpm(value: number | null) {
  if (value === null) return "—";
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default async function TracksPage() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims) {
    redirect("/login");
  }

  const { data: tracks, error } = await supabase
    .from("tracks")
    .select(
      "id, title, artist, bpm, musical_key, energy, mood, source, notes, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950">
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MixBrain</p>
              <p className="text-xs text-slate-400">Biblioteca de tracks</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
            >
              Voltar ao workspace
            </Link>
            <LogoutButton />
          </div>
        </header>

        <section className="mt-8 rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 via-slate-900 to-violet-500/10 p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Biblioteca
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">
            Tracks do catálogo
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Cadastre e organize as tracks que poderão virar candidatas em
            projetos futuros.
          </p>
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <CreateTrackForm />

          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Catálogo atual
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-50">
                  {tracks?.length ?? 0} tracks cadastradas
                </h2>
              </div>
            </div>

            {tracks && tracks.length > 0 ? (
              <div className="mt-6 space-y-4">
                {tracks.map((track) => (
                  <article
                    key={track.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold tracking-tight text-slate-100">
                          {track.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {track.artist}
                        </p>
                      </div>

                      <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                        {track.energy ? `Energia ${track.energy}/10` : "Sem energia"}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          BPM
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">
                          {formatBpm(track.bpm)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Tonalidade
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">
                          {track.musical_key?.trim() ? track.musical_key : "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Mood
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">
                          {track.mood?.trim() ? track.mood : "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Origem
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">
                          {track.source?.trim() ? track.source : "—"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 sm:col-span-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Observações
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-200">
                          {track.notes?.trim() ? track.notes : "Sem observações"}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/50 p-6">
                <p className="text-sm leading-7 text-slate-400">
                  Nenhuma track cadastrada ainda. Use o formulário ao lado para
                  criar a primeira entrada da biblioteca.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}