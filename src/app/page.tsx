import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  const isAuthenticated = !!claims;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-cyan-300 text-3xl font-black text-slate-950">
            M
          </div>
        </div>

        <h1 className="text-4xl font-black tracking-tight">MixBrain</h1>
        <p className="mt-3 text-base leading-7 text-slate-400">
          Curadoria inteligente para sets de música eletrônica.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {isAuthenticated ? (
            <Link
              href="/app"
              className="rounded-xl bg-cyan-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-200"
            >
              Entrar no workspace
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-cyan-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-cyan-200"
            >
              Fazer login
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}