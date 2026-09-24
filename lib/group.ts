import type { CinemaRow, MovieRow, ShowtimeRow } from "@/types/database";
import { haversineKm } from "./utils";

export type ShowtimeView = ShowtimeRow & {
  movie: MovieRow;
  cinema: CinemaRow;
};

export type Origin = { lat: number; lng: number };

/** Shows you can still walk into, soonest first. A 10:30 screening at 8pm is noise. */
export function upcoming<T extends { start_time: string }>(rows: T[], now = Date.now()) {
  return rows
    .filter((r) => new Date(r.start_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

function dist(origin: Origin, c: CinemaRow) {
  if (!c.latitude && !c.longitude) return Infinity;
  return haversineKm(origin, { lat: c.latitude, lng: c.longitude });
}

/** Unique films, most-screened first: the easiest one to walk into leads the rail. */
export function nowShowing(showtimes: ShowtimeView[]) {
  const map = new Map<string, { movie: MovieRow; count: number }>();
  for (const s of showtimes) {
    const cur = map.get(s.movie.id);
    if (cur) cur.count += 1;
    else map.set(s.movie.id, { movie: s.movie, count: 1 });
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.movie.title.localeCompare(b.movie.title))
    .map((m) => m.movie);
}

/** Soonest screening per film. One row per film, so a saved list stays small. */
export type NextShow = {
  start_time: string;
  mall: string;
  booking_url: string;
  cinema_name: string;
  chain: string;
  screen_type: string;
  price: number | null;
};

export function nextPerMovie(showtimes: ShowtimeView[]) {
  const next: Record<string, NextShow> = {};
  for (const s of upcoming(showtimes)) {
    next[s.movie_id] ??= {
      start_time: s.start_time,
      mall: s.cinema.mall,
      booking_url: s.booking_direct_url,
      cinema_name: s.cinema.name,
      chain: s.cinema.chain,
      screen_type: s.screen_type,
      price: s.price,
    };
  }
  return next;
}

export function groupByMall(showtimes: ShowtimeView[], origin?: Origin) {
  const map = new Map<string, { cinema: CinemaRow; times: ShowtimeView[] }>();
  for (const s of showtimes) {
    const cur = map.get(s.cinema.id);
    if (cur) cur.times.push(s);
    else map.set(s.cinema.id, { cinema: s.cinema, times: [s] });
  }
  return [...map.values()].sort((a, b) => {
    if (origin) {
      const d = dist(origin, a.cinema) - dist(origin, b.cinema);
      if (d !== 0) return d;
    }
    return a.cinema.mall.localeCompare(b.cinema.mall);
  });
}
