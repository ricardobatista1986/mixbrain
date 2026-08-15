"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    });

    setIsLoading(false);

    if (error) {
      setMessage(
        "Não foi possível entrar. Confira e-mail e senha e tente novamente.",
      );
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center bg-claude-bg px-6 text-claude-text">
      <section className="w-full max-w-md rounded-3xl border border-claude-border bg-claude-surface/70 p-7 shadow-2xl shadow-claude-bg/30 sm:p-9">
        <Link
          href="/"
          className="inline-flex items-center gap-3 transition hover:opacity-80"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-claude-accent font-black text-claude-bg">
            M
          </div>
          <div>
            <p className="font-bold tracking-tight">MixBrain</p>
            <p className="text-xs text-claude-text-muted">Acesso privado</p>
          </div>
        </Link>

        <div className="mt-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-claude-accent">
            Entrar
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">
            Bem-vindo de volta.
          </h1>
          <p className="mt-3 leading-7 text-claude-text-muted">
            Entre para acessar seus sets, biblioteca e decisões de curadoria.
          </p>
        </div>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              E-mail
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
              placeholder="seu@email.com"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-claude-text-muted">
              Senha
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-claude-border bg-claude-bg px-4 py-3 text-claude-text outline-none transition placeholder:text-claude-text-faint focus:border-claude-accent focus:ring-2 focus:ring-claude-accent/20"
              placeholder="Sua senha do MixBrain"
            />
          </label>

          {message ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100"
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-claude-accent px-4 py-3 font-bold text-claude-bg transition hover:bg-claude-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-7 text-center text-xs leading-5 text-claude-text0">
          Este ambiente é privado. Novas contas não podem ser criadas pela
          página de login.
        </p>
      </section>
    </main>
  );
}