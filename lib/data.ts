import { cityInFilter, citiesInFilter } from "./cities";
import { SEED } from "./seed";
import { createServerSupabase } from "./supabase/server";
import { horizonDates, localDateKey } from "./utils";
import { nextPerMovie, nowShowing, upcoming } from "./group";
import type { ShowtimeView } from "./group";
import { applyLocalTitles, loadInventoryFile, missingMovieIds } from "./inventory";
import { OFFICIAL_BOOKERS } from "./bookers";
import { getNowPlayingPh, getTmdbMovie, parseTmdbId, tmdbConfigured } from "./tmdb";
import type { CinemaRow, CitySlug, CinemaChain, LocationFilterId, MovieRow, ScreenType, ShowtimeRow } from "@/types/database";

export type { ShowtimeView } from "./group";
export { groupByMall } from "./group";
export { OFFICIAL_BOOKERS };

export type Filters = {
  city: LocationFilterId;
  date: string;
  chain: CinemaChain | "all";
  format: ScreenType | "all";
};

export type CatalogSource = {
  movies: "tmdb-ph" | "supabase" | "seed";
  showtimes: "supabase" | "file" | "seed" | "none";
};

export function isoDate(d = new Date()) {
  return localDateKey(d);
}

function applyFilters(showtimes: ShowtimeView[], f: Filters) {
  return upcoming(
    showtimes.filter((s) => {
      if (!cityInFilter(f.city, s.cinema.city)) return false;
      if (localDateKey(new Date(s.start_time)) !== f.date) return false;
      if (f.chain !== "all" && s.cinema.chain !== f.chain) return false;
      if (f.format !== "all" && s.screen_type !== f.format) return false;
      return true;
    }),
  );
}

function attach(
  showtimes: ShowtimeRow[],
  movies: MovieRow[],
  cinemas: CinemaRow[],
): ShowtimeView[] {
  return showtimes
    .map((s) => ({
      ...s,
      movie: movies.find((m) => m.id === s.movie_id)!,
      cinema: cinemas.find((c) => c.id === s.cinema_id)!,
    }))
    .filter((s) => s.movie && s.cinema);
}

async function hydrateMissing(showtimes: ShowtimeRow[], known: MovieRow[]) {
  if (!tmdbConfigured()) return [];
  const rows = await Promise.all(
    missingMovieIds(showtimes, known).map((id) => {
      const tmdbId = parseTmdbId(id);
      return tmdbId ? getTmdbMovie(tmdbId).catch(() => null) : null;
    }),
  );
  return rows.filter((m): m is MovieRow => Boolean(m));
}

export async function getCatalog() {
  const sb = await createServerSupabase();
  if (sb) {
    const [movies, cinemas, showtimes, promos, reviews] = await Promise.all([
      sb.from("movies").select("*"),
      sb.from("cinemas").select("*"),
      sb.from("showtimes").select("*"),
      sb.from("local_promos").select("*"),
      sb.from("movie_reviews").select("*"),
    ]);
    if (movies.data?.length && cinemas.data?.length) {
      const cinemaRows = cinemas.data;
      const movieRows = movies.data;
      const showRows = showtimes.data ?? [];
      return {
        movies: movieRows,
        cinemas: cinemaRows,
        showtimes: attach(showRows, movieRows, cinemaRows),
        promos: promos.data?.length ? promos.data : SEED.promos,
        reviews: reviews.data?.length ? reviews.data : SEED.reviews,
        source: {
          movies: "supabase",
          showtimes: showRows.length ? "supabase" : "none",
        } satisfies CatalogSource,
      };
    }
  }

  const tmdbMovies = tmdbConfigured() ? await getNowPlayingPh().catch(() => [] as MovieRow[]) : [];
  const nowPlaying = tmdbMovies.length ? tmdbMovies : SEED.movies;
  const cinemas = SEED.cinemas;
  const { rows: fileShows, titles } = await loadInventoryFile();
  const useLiveTitles = tmdbMovies.length > 0;
  const showRows = fileShows.length ? fileShows : useLiveTitles ? [] : SEED.showtimes;

  const movies = applyLocalTitles(
    [...nowPlaying, ...(await hydrateMissing(showRows, nowPlaying))],
    titles,
  );

  return {
    movies,
    cinemas,
    showtimes: attach(showRows, movies, cinemas),
    promos: SEED.promos,
    reviews: useLiveTitles ? [] : SEED.reviews,
    source: {
      movies: tmdbMovies.length ? "tmdb-ph" : "seed",
      showtimes: fileShows.length ? "file" : useLiveTitles ? "none" : "seed",
    } satisfies CatalogSource,
  };
}

export async function getFilteredShowtimes(f: Filters) {
  const { showtimes, cinemas, movies, source } = await getCatalog();
  const today = isoDate();
  const live = showtimes.filter((s) => localDateKey(new Date(s.start_time)) >= today);
  const region = citiesInFilter(f.city);
  const inCity = live.filter((s) => region.includes(s.cinema.city));
  return {
    showtimes: applyFilters(showtimes, f),
    dates: horizonDates(showtimes, f.city, today, f.date),
    cinemas: cinemas.filter((c) => region.includes(c.city)),
    movies,
    source,
    // Only offer controls that lead somewhere: cities and chains we actually have times for.
    cities: [...new Set(live.map((s) => s.cinema.city))],
    chains: [...new Set(inCity.map((s) => s.cinema.chain))],
    formats: [...new Set(inCity.map((s) => s.screen_type))],
  };
}

/** First-visit gate: the areas worth offering, plus a few posters so the ask isn't a blank screen. */
export async function getGate(): Promise<{ cities: CitySlug[]; films: MovieRow[] }> {
  const { showtimes } = await getCatalog();
  const today = isoDate();
  const live = showtimes.filter((s) => localDateKey(new Date(s.start_time)) >= today);
  return {
    cities: [...new Set(live.map((s) => s.cinema.city))],
    films: nowShowing(live)
      .filter((m) => m.poster_url)
      .slice(0, 10),
  };
}

/**
 * Next upcoming screening per film in one city — one row per film, not per showtime, so the
 * saved list can answer "when can I see this?" without shipping the whole city's inventory.
 */
export async function getNextScreenings(city: LocationFilterId) {
  const { showtimes } = await getCatalog();
  const region = citiesInFilter(city);
  return nextPerMovie(showtimes.filter((s) => region.includes(s.cinema.city)));
}

export async function getMovieBySlug(slug: string, city: LocationFilterId) {
  const { movies, showtimes, reviews, source } = await getCatalog();
  let movie = movies.find((m) => m.slug === slug);
  if (!movie) return null;
  const tmdbId = parseTmdbId(movie.id);
  if (tmdbId && tmdbConfigured()) {
    const detail = await getTmdbMovie(tmdbId).catch(() => null);
    if (detail) movie = { ...movie, ...detail, slug: movie.slug };
  }
  const playing = upcoming(showtimes.filter((s) => s.movie_id === movie!.id));
  const region = citiesInFilter(city);
  return {
    movie,
    showtimes: playing.filter((s) => region.includes(s.cinema.city)),
    cities: [...new Set(playing.map((s) => s.cinema.city))],
    reviews: reviews.filter((r) => r.movie_id === movie!.id),
    source,
  };
}
