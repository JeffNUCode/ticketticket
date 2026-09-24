/** Client watchlist — movies and events, local to this device. */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const KEY = "gosee-saved";

export type SavedMovie = {
  kind?: "movie";
  movieId: string;
  title: string;
  slug: string;
  poster?: string;
};

export type SavedEvent = {
  kind: "event";
  eventId: string;
  title: string;
  bookingUrl: string;
  poster?: string;
  venue?: string;
  /** Display string, e.g. "Sat, Sep 25, 7:00 PM". */
  when?: string;
};

export type Saved = SavedMovie | SavedEvent;

function isEvent(row: Saved): row is SavedEvent {
  return (row as { kind?: string }).kind === "event";
}

function isMovie(row: Saved): row is SavedMovie {
  return !isEvent(row) && typeof (row as SavedMovie).movieId === "string";
}

function read(): Saved[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Saved[];
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => {
      if (!r?.title) return false;
      if (isEvent(r)) return !!r.eventId && !!r.bookingUrl;
      return !!(r as SavedMovie).movieId;
    });
  } catch {
    return [];
  }
}

function write(rows: Saved[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function useWatchlist() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [KEY], queryFn: async () => read(), initialData: [] });
  const mut = useMutation({
    mutationFn: async (next: Saved[]) => {
      write(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData([KEY], next),
  });

  const saved = q.data ?? [];
  const movies = saved.filter(isMovie);
  const events = saved.filter(isEvent);

  function has(movieId: string) {
    return movies.some((a) => a.movieId === movieId);
  }

  function toggle(movie: SavedMovie) {
    const cur = q.data ?? [];
    const rest = cur.filter((a) => !(isMovie(a) && a.movieId === movie.movieId));
    mut.mutate(has(movie.movieId) ? rest : [...rest, { ...movie, kind: "movie" as const }]);
  }

  function hasEvent(eventId: string) {
    return events.some((a) => a.eventId === eventId);
  }

  function toggleEvent(event: SavedEvent) {
    const cur = q.data ?? [];
    const rest = cur.filter((a) => !(isEvent(a) && a.eventId === event.eventId));
    mut.mutate(hasEvent(event.eventId) ? rest : [...rest, event]);
  }

  return { saved, movies, events, has, toggle, hasEvent, toggleEvent };
}
