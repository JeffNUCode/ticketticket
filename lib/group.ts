import type { CinemaRow, MovieRow, ShowtimeRow } from "@/types/database";

export type ShowtimeView = ShowtimeRow & {
  movie: MovieRow;
  cinema: CinemaRow;
};

export function groupByMall(showtimes: ShowtimeView[]) {
  const map = new Map<string, { cinema: CinemaRow; times: ShowtimeView[] }>();
  for (const s of showtimes) {
    const cur = map.get(s.cinema.id);
    if (cur) cur.times.push(s);
    else map.set(s.cinema.id, { cinema: s.cinema, times: [s] });
  }
  return [...map.values()].sort((a, b) => a.cinema.mall.localeCompare(b.cinema.mall));
}
