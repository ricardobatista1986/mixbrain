"use client";

import { useState, type ReactNode } from "react";

export function ProjectTabs({
  tabs,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");

  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-claude-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-bold transition ${
              active === tab.key
                ? "border-claude-accent text-claude-accent"
                : "border-transparent text-claude-text-muted hover:text-claude-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div key={tab.key} className={active === tab.key ? "" : "hidden"}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
