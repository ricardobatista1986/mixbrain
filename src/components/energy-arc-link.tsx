"use client";

import Link from "next/link";

export function EnergyArcLink({ projectId }: { projectId: string }) {
  return (
    <Link
      href={`/app/projetos/${projectId}/arco-energia`}
      className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
    >
      Arco de energia
    </Link>
  );
}
