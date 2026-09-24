import { readFile } from "fs/promises";
import path from "path";
import { slugify } from "./utils";
import type { MovieRow, ScreenType, ShowtimeRow } from "@/types/database";

/** Manual/partner ingest. Fill `data/showtimes.json` — never invent times. */
export type InventoryShow = {
  movie_id: string;
  /** Title as the cinema bills it. Authoritative for display — TMDB only fills in metadata. */
  title?: string;
  cinema_id: string;
  screen_type: ScreenType;
  start_time: string;
  price: number | null;
  booking_direct_url: string;
};

export async function loadInventoryFile(): Promise<{
  rows: ShowtimeRow[];
  titles: Map<string, string>;
}> {
  try {
    const raw = await readFile(path.join(process.cwd(), "data/showtimes.json"), "utf8");
    const parsed = JSON.parse(raw) as InventoryShow[];
    if (!Array.isArray(parsed)) return { rows: [], titles: new Map() };
    const valid = parsed.filter((r) => r.movie_id && r.cinema_id && r.start_time);
    const titles = new Map<string, string>();
    for (const r of valid) {
      if (r.title && !titles.has(r.movie_id)) titles.set(r.movie_id, r.title);
    }
    return {
      titles,
      rows: valid.map((r, i) => ({
        id: `inv-${i + 1}`,
        movie_id: r.movie_id,
        cinema_id: r.cinema_id,
        screen_type: r.screen_type,
        start_time: r.start_time,
        price: r.price,
        booking_direct_url: r.booking_direct_url,
        updated_at: new Date().toISOString(),
      })),
    };
  } catch {
    return { rows: [], titles: new Map() };
  }
}

/** Restore the billed title over TMDB's export title (TMDB ships "Himala" as "Miracle"). */
export function applyLocalTitles(movies: MovieRow[], titles: Map<string, string>): MovieRow[] {
  if (titles.size === 0) return movies;
  return movies.map((m) => {
    const title = titles.get(m.id);
    if (!title || title === m.title) return m;
    const tmdbId = /^tmdb-(\d+)$/.exec(m.id)?.[1];
    return { ...m, title, slug: tmdbId ? `${slugify(title)}-${tmdbId}` : m.slug };
  });
}

/**
 * Movie ids that have showtimes but no catalog entry. Cinemas screen re-runs and local
 * classics that TMDB's now-playing window omits; without hydrating these the join drops them.
 */
export function missingMovieIds(showtimes: ShowtimeRow[], known: { id: string }[]) {
  const have = new Set(known.map((m) => m.id));
  return [...new Set(showtimes.map((s) => s.movie_id))].filter((id) => !have.has(id));
}

export { OFFICIAL_BOOKERS } from "./bookers";
