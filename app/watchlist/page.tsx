"use client";

import Link from "next/link";
import { useWatchlist } from "@/lib/watchlist";
import { SEED } from "@/lib/seed";

export default function WatchlistPage() {
  const { alerts, toggle } = useWatchlist();
  return (
    <div className="space-y-5">
      <h1 className="page-title">Seat-drop alerts</h1>
      <p className="text-sm text-white/55">
        Saved on this device. Alerts do not send email yet.
      </p>
      {alerts.length === 0 ? (
        <p className="panel p-5 text-sm text-white/70">
          No alerts yet. Open a movie and tap notify.
        </p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const movie = SEED.movies.find((m) => m.id === a.movieId);
            return (
              <li
                key={`${a.movieId}-${a.screenType}`}
                className="panel flex items-center justify-between gap-3 p-4"
              >
                <div>
                  <Link
                    href={movie ? `/movie/${movie.slug}` : "/"}
                    className="font-semibold text-white hover:text-zap"
                  >
                    {movie?.title ?? a.movieId}
                  </Link>
                  <p className="text-xs text-white/45">{a.screenType}</p>
                </div>
                <button
                  type="button"
                  className="min-h-11 rounded-full px-3 text-sm text-white/50 hover:text-white"
                  onClick={() => toggle(a.movieId, a.screenType)}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
