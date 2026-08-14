import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";
import { CreateTrackForm } from "@/components/create-track-form";
import { TracksLibrary } from "@/components/tracks-library";

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
    <main
      className="min-h-screen px-6 py-10 sm:px-10"
      style={{ background: "var(--mb-canvas)", color: "var(--mb-text-primary)" }}
    >
      <div className="mx-auto max-w-7xl">
        <header
          className="flex flex-wrap items-center justify-between gap-4 pb-6"
          style={{ borderBottom: "1px solid var(--mb-border)" }}
        >
          <Link href="/" className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-xl font-black"
              style={{ background: "var(--mb-accent)", color: "#1c1a19" }}
            >
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MixBrain</p>
              <p className="text-xs" style={{ color: "var(--mb-text-muted)" }}>
                Biblioteca de tracks
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="rounded-full px-4 py-2 text-sm font-medium transition"
              style={{
                border: "1px solid var(--mb-border)",
                color: "var(--mb-text-secondary)",
              }}
            >
              Voltar ao workspace
            </Link>
            <LogoutButton />
          </div>
        </header>

        <section
          className="mt-8 rounded-3xl p-8 sm:p-12"
          style={{
            border: "1px solid var(--mb-accent-soft)",
            background:
              "linear-gradient(135deg, var(--mb-accent-soft), var(--mb-surface) 55%, var(--mb-surface))",
          }}
        >
          <p
            className="text-sm font-semibold uppercase tracking-[0.24em]"
            style={{ color: "var(--mb-accent-text)" }}
          >
            Biblioteca
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">
            Tracks do catálogo
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8" style={{ color: "var(--mb-text-secondary)" }}>
            Cadastre e organize as tracks que poderão virar candidatas em
            projetos futuros.
          </p>
        </section>

        <div className="mt-10 grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
          <CreateTrackForm />
          <TracksLibrary tracks={tracks ?? []} />
        </div>
      </div>
    </main>
  );
}
