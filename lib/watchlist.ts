"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const KEY = "tt-watchlist";

export type Alert = { movieId: string; screenType: string };

function read(): Alert[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Alert[];
  } catch {
    return [];
  }
}

function write(rows: Alert[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function useWatchlist() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: [KEY], queryFn: async () => read(), initialData: [] });
  const mut = useMutation({
    mutationFn: async (next: Alert[]) => {
      write(next);
      return next;
    },
    onSuccess: (next) => qc.setQueryData([KEY], next),
  });

  function has(movieId: string, screenType: string) {
    return (q.data ?? []).some((a) => a.movieId === movieId && a.screenType === screenType);
  }

  function toggle(movieId: string, screenType: string) {
    const cur = q.data ?? [];
    const next = has(movieId, screenType)
      ? cur.filter((a) => !(a.movieId === movieId && a.screenType === screenType))
      : [...cur, { movieId, screenType }];
    mut.mutate(next);
  }

  return { alerts: q.data ?? [], has, toggle };
}
