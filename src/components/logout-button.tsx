"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-full border border-claude-border px-4 py-2 text-sm font-medium text-claude-text-muted transition hover:border-rose-300/50 hover:text-rose-200"
    >
      Sair
    </button>
  );
}