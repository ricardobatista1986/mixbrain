export type LibraryHealthTrack = {
  artist: string;
  bpm: number | null;
  musical_key: string | null;
  energy: number | null;
  mood: string | null;
};

function computeStats(tracks: LibraryHealthTrack[]) {
  const total = tracks.length;

  const withBpm = tracks.filter((t) => t.bpm !== null).length;
  const withKey = tracks.filter((t) => t.musical_key).length;
  const withEnergy = tracks.filter((t) => t.energy !== null).length;
  const withMood = tracks.filter((t) => t.mood).length;

  const artistCounts = new Map<string, number>();
  for (const track of tracks) {
    const artist = track.artist || "Artista não informado";
    artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
  }

  const topArtists = [...artistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return { total, withBpm, withKey, withEnergy, withMood, topArtists };
}

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function CoverageBar({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = pct(value, total);
  const tone = percent >= 80 ? "bg-emerald-400" : percent >= 40 ? "bg-amber-400" : "bg-rose-400";

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-claude-text-muted">
        <span>{label}</span>
        <span>
          {value}/{total} ({percent}%)
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-claude-surface-3">
        <div className={`h-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function LibraryHealthPanel({ tracks }: { tracks: LibraryHealthTrack[] }) {
  if (tracks.length === 0) return null;

  const stats = computeStats(tracks);
  const topArtistShare = stats.topArtists.length > 0
    ? pct(stats.topArtists[0][1], stats.total)
    : 0;

  return (
    <section className="rounded-3xl border border-claude-border bg-claude-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-claude-accent">
        Diagnóstico
      </p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-claude-text">
        Saúde da biblioteca
      </h2>

      <div className="mt-5 space-y-3">
        <CoverageBar label="Com BPM" value={stats.withBpm} total={stats.total} />
        <CoverageBar label="Com key" value={stats.withKey} total={stats.total} />
        <CoverageBar label="Com energia" value={stats.withEnergy} total={stats.total} />
        <CoverageBar label="Com mood" value={stats.withMood} total={stats.total} />
      </div>

      {stats.topArtists.length > 0 ? (
        <div className="mt-5 border-t border-claude-border pt-4">
          <p className="text-xs font-semibold text-claude-text-muted">
            Concentração por artista
          </p>
          <div className="mt-2 space-y-1.5">
            {stats.topArtists.map(([artist, count]) => (
              <div key={artist} className="flex items-center justify-between text-xs">
                <span className="truncate text-claude-text">{artist}</span>
                <span className="shrink-0 text-claude-text-faint">
                  {count} ({pct(count, stats.total)}%)
                </span>
              </div>
            ))}
          </div>
          {topArtistShare >= 25 ? (
            <p className="mt-3 text-[11px] leading-4 text-amber-300">
              Um único artista responde por {topArtistShare}% da biblioteca — as
              sugestões inteligentes limitam a 2 por artista para compensar isso.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
