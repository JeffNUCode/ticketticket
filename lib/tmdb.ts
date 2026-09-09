import { unstable_cache } from "next/cache";
import { slugify } from "./utils";
import type { MovieRow } from "@/types/database";

const IMG = "https://image.tmdb.org/t/p";

export function tmdbConfigured() {
  return Boolean(process.env.TMDB_API_KEY);
}

function key() {
  return process.env.TMDB_API_KEY!;
}

async function tmdb<T>(path: string): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set("api_key", key());
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`TMDB ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

type TmdbMovie = {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  original_language: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number | null;
};

type TmdbPage = { results: TmdbMovie[] };
type TmdbGenreList = { genres: { id: number; name: string }[] };
type TmdbVideo = { results: { key: string; site: string; type: string }[] };
type TmdbCredits = { cast: { name: string }[] };

function poster(path: string | null) {
  return path ? `${IMG}/w500${path}` : "";
}

function backdrop(path: string | null) {
  return path ? `${IMG}/w1280${path}` : "";
}

const PH_LANGS = new Set(["tl", "fil"]);

/** TMDB exports local films under English titles ("Himala" -> "Miracle"), which no PH cinema uses. */
function displayTitle(m: TmdbMovie) {
  return PH_LANGS.has(m.original_language) && m.original_title ? m.original_title : m.title;
}

function toRow(
  m: TmdbMovie,
  genreNames: string[],
  extras?: { runtime?: number; trailer?: string | null; cast?: string[] },
): MovieRow {
  const title = displayTitle(m);
  return {
    id: `tmdb-${m.id}`,
    title,
    original_title: m.original_title,
    slug: `${slugify(title)}-${m.id}`,
    poster_url: poster(m.poster_path),
    backdrop_url: backdrop(m.backdrop_path) || poster(m.poster_path),
    synopsis: m.overview ?? "",
    duration_mins: extras?.runtime ?? m.runtime ?? 0,
    release_date: m.release_date || "",
    rating: "NR",
    genres: genreNames,
    trailer_youtube_id: extras?.trailer ?? null,
    cast: extras?.cast ?? [],
    created_at: new Date().toISOString(),
  };
}

export async function fetchNowPlayingPh(): Promise<MovieRow[]> {
  const [page, genreList] = await Promise.all([
    tmdb<TmdbPage>("/movie/now_playing?region=PH&language=en-US&page=1"),
    tmdb<TmdbGenreList>("/genre/movie/list?language=en-US"),
  ]);
  const names = new Map(genreList.genres.map((g) => [g.id, g.name]));
  return page.results.map((m) =>
    toRow(
      m,
      (m.genre_ids ?? []).map((id) => names.get(id)).filter((n): n is string => Boolean(n)),
    ),
  );
}

export const getNowPlayingPh = unstable_cache(fetchNowPlayingPh, ["tmdb-now-playing-ph"], {
  revalidate: 3600,
  tags: ["tmdb"],
});

export async function fetchTmdbMovie(tmdbId: number): Promise<MovieRow | null> {
  const [detail, videos, credits] = await Promise.all([
    tmdb<TmdbMovie>(`/movie/${tmdbId}?language=en-US`),
    tmdb<TmdbVideo>(`/movie/${tmdbId}/videos?language=en-US`),
    tmdb<TmdbCredits>(`/movie/${tmdbId}/credits`),
  ]);
  const trailer =
    videos.results.find((v) => v.site === "YouTube" && v.type === "Trailer")?.key ??
    videos.results.find((v) => v.site === "YouTube")?.key ??
    null;
  return toRow(
    detail,
    (detail.genres ?? []).map((g) => g.name),
    {
      runtime: detail.runtime ?? 0,
      trailer,
      cast: credits.cast.slice(0, 8).map((c) => c.name),
    },
  );
}

export const getTmdbMovie = unstable_cache(fetchTmdbMovie, ["tmdb-movie"], {
  revalidate: 3600,
  tags: ["tmdb"],
});

export async function searchMovieId(title: string): Promise<number | null> {
  const page = await tmdb<TmdbPage>(
    `/search/movie?language=en-US&include_adult=false&query=${encodeURIComponent(title)}`,
  );
  return page.results[0]?.id ?? null;
}

export function parseTmdbId(movieId: string) {
  const m = /^tmdb-(\d+)$/.exec(movieId);
  return m ? Number(m[1]) : null;
}
