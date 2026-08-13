"use client";

export type ExportRow = {
  position: number;
  title: string;
  artist: string;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
  blockName: string | null;
};

function escapeCsvField(value: string) {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(rows: ExportRow[]) {
  const header = [
    "Posição",
    "Título",
    "Artista",
    "BPM",
    "Key",
    "Energia",
    "Mood",
    "Bloco",
  ].join(",");

  const lines = rows.map((row) =>
    [
      String(row.position),
      escapeCsvField(row.title),
      escapeCsvField(row.artist),
      row.bpm !== null ? String(row.bpm) : "",
      row.musical_key ? escapeCsvField(row.musical_key) : "",
      row.energy !== null ? String(row.energy) : "",
      row.mood ? escapeCsvField(row.mood) : "",
      row.blockName ? escapeCsvField(row.blockName) : "",
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

function buildTxt(rows: ExportRow[], projectName: string) {
  const lines = [`Tracklist — ${projectName}`, ""];
  let lastBlock: string | null = null;

  for (const row of rows) {
    if (row.blockName && row.blockName !== lastBlock) {
      lines.push("", `[Bloco: ${row.blockName}]`);
    }
    if (!row.blockName) {
      lastBlock = null;
    } else {
      lastBlock = row.blockName;
    }

    const details = [
      row.bpm !== null ? `${row.bpm} BPM` : null,
      row.musical_key,
      row.energy !== null ? `E${row.energy}` : null,
      row.mood,
    ]
      .filter(Boolean)
      .join(" · ");

    lines.push(
      `${String(row.position).padStart(2, "0")}. ${row.title} — ${row.artist}` +
        (details ? ` (${details})` : "")
    );
  }

  return lines.join("\n");
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "tracklist"
  );
}

export function ExportTracklistButtons({
  rows,
  projectName,
}: {
  rows: ExportRow[];
  projectName: string;
}) {
  if (rows.length === 0) {
    return null;
  }

  const baseName = slugify(projectName);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => downloadBlob(buildCsv(rows), `${baseName}.csv`, "text/csv")}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
      >
        Exportar CSV
      </button>
      <button
        type="button"
        onClick={() => downloadBlob(buildTxt(rows, projectName), `${baseName}.txt`, "text/plain")}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-100"
      >
        Exportar TXT
      </button>
    </div>
  );
}
