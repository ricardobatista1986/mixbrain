"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AppPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setEmail(session.user.email ?? null);
      setIsCheckingSession(false);
    }

    checkSession();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (isCheckingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-300">
        Verificando acesso privado...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950">
              M
            </div>
            <div>
              <p className="font-bold tracking-tight">MixBrain</p>
              <p className="text-xs text-slate-400">Workspace privado</p>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-rose-300/50 hover:text-rose-200"
          >
            Sair
          </button>
        </header>

        <section className="mt-16 rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/10 via-slate-900 to-violet-500/10 p-8 sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">
            Acesso confirmado
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight">
            O MixBrain está conectado ao seu ambiente privado.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            {email
              ? `Sessão ativa para ${email}. `
              : ""}
            A próxima etapa criará o modelo de dados seguro para projetos, tracks
            e versões de set.
          </p>
        </section>
      </div>
    </main>
  );
}