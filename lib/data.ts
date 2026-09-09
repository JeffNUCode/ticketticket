import { SEED } from "./seed";
import { createServerSupabase } from "./supabase/server";
import { horizonDates, localDateKey } from "./utils";
import type { ShowtimeView } from "./group";
import { applyLocalTitles, loadInventoryFile, missingMovieIds, OFFICIAL_BOOKERS } from "./inventory";
import { getNowPlayingPh, getTmdbMovie, parseTmdbId, tmdbConfigured } from "./tmdb";
import type { CinemaRow, CitySlug, CinemaChain, MovieRow, ScreenType, ShowtimeRow } from "@/types/database";

export type { ShowtimeView } from "./group";
export { groupByMall } from "./group";
export { OFFICIAL_BOOKERS };

export type Filters = {
  city: CitySlug;
  date: string;
  chain: CinemaChain | "all";
  genre: string | "all";
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
  return showtimes.filter((s) => {
    if (s.cinema.city !== f.city) return false;
    if (localDateKey(new Date(s.start_time)) !== f.date) return false;
    if (f.chain !== "all" && s.cinema.chain !== f.chain) return false;
    if (f.format !== "all" && s.screen_type !== f.format) return false;
    if (f.genre !== "all" && !s.movie.genres.includes(f.genre)) return false;
    return true;
  });
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
  const { showtimes, promos, cinemas, movies, source } = await getCatalog();
  const movieList =
    f.genre === "all" ? movies : movies.filter((m) => m.genres.includes(f.genre));
  return {
    showtimes: applyFilters(showtimes, f),
    dates: horizonDates(showtimes, f.city, isoDate(), f.date),
    promos,
    cinemas: cinemas.filter((c) => c.city === f.city),
    movies: movieList,
    source,
  };
}

export async function getMovieBySlug(slug: string) {
  const { movies, showtimes, reviews, cinemas, source } = await getCatalog();
  let movie = movies.find((m) => m.slug === slug);
  if (!movie) return null;
  const tmdbId = parseTmdbId(movie.id);
  if (tmdbId && tmdbConfigured()) {
    const detail = await getTmdbMovie(tmdbId).catch(() => null);
    if (detail) movie = { ...movie, ...detail, slug: movie.slug };
  }
  return {
    movie,
    showtimes: showtimes.filter((s) => s.movie_id === movie.id),
    reviews: reviews.filter((r) => r.movie_id === movie.id),
    cinemas,
    source,
  };
}

export function genresFrom(movies: MovieRow[]) {
  return [...new Set(movies.flatMap((m) => m.genres))].sort();
}
