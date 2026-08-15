import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { CreateTrackForm } from "@/components/create-track-form";
import { TracksLibrary } from "@/components/tracks-library";
import { LibraryHealthPanel } from "@/components/library-health-panel";

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
    <main className="min-h-screen bg-claude-bg px-6 py-10 text-claude-text sm:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-claude-border pb-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-claude-accent font-black text-claude-bg">
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MixBrain</p>
              <p className="text-xs text-claude-text-muted">Biblioteca de tracks</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="rounded-full border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted transition hover:border-claude-accent/50 hover:text-claude-accent-hover"
            >
              Voltar ao workspace
            </Link>
            <LogoutButton />
          </div>
        </header>

        <section className="mt-8 rounded-3xl border border-claude-accent/20 bg-gradient-to-br from-claude-accent/10 via-claude-surface to-violet-500/10 p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-claude-accent-hover">
            Biblioteca
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">
            Tracks do catálogo
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-claude-text-muted">
            Cadastre e organize as tracks que poderão virar candidatas em
            projetos futuros.
          </p>
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col gap-8">
            <CreateTrackForm />
            <LibraryHealthPanel tracks={tracks ?? []} />
          </div>
          <TracksLibrary tracks={tracks ?? []} />
        </div>
      </div>
    </main>
  );
}
