import { normalizeTitle } from "../lib/ingest";
import { fetchNowPlayingPh, searchMovieId } from "../lib/tmdb";

/**
 * Resolves a cinema's billed title to a TMDB id: now-playing exact, then loose contains,
 * then a search call (memoised, since one film screens many times a day).
 */
export async function createTitleMatcher() {
  const catalog = await fetchNowPlayingPh();
  const byTitle = new Map(catalog.map((m) => [normalizeTitle(m.title), m.id]));
  const searched = new Map<string, string | null>();

  return async function match(title: string): Promise<string | null> {
    const norm = normalizeTitle(title);
    const exact = byTitle.get(norm);
    if (exact) return exact;

    const partial = [...byTitle.entries()].find(([k]) => k.includes(norm) || norm.includes(k));
    if (partial) return partial[1];

    if (!searched.has(norm)) {
      const id = await searchMovieId(title);
      searched.set(norm, id ? `tmdb-${id}` : null);
    }
    return searched.get(norm) ?? null;
  };
}
