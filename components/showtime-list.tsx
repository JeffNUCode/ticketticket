"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Utensils } from "lucide-react";
import { ShowBookDrawer } from "@/components/show-handoff";
import { filterIdForCity, writeOrigin } from "@/lib/cities";
import { groupByMall, type Origin, type ShowtimeView } from "@/lib/group";
import { formatClock, mapsSearchUrl, peso } from "@/lib/utils";
import type { CinemaRow } from "@/types/database";

/**
 * Mall cards with tappable times. Shared by Discover and the movie page so a time
 * behaves the same wherever it appears.
 */
export function MallTimes({
  showtimes,
  showTitles = true,
  origin,
}: {
  showtimes: ShowtimeView[];
  showTitles?: boolean;
  /** Nearest mall first. Without it the list is A–Z, which "closest cinemas" would be lying about. */
  origin?: Origin;
}) {
  const [picked, setPicked] = useState<ShowtimeView | null>(null);
  const groups = groupByMall(showtimes, origin);

  return (
    <div className="space-y-3">
      {groups.map(({ cinema, times }) => (
        <section key={cinema.id} className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-white">{cinema.mall}</h3>
              <p className="text-xs text-white/60">
                {cinema.chain} · {cinema.address}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <EatNearMall cinema={cinema} />
              <a
                href={mapsSearchUrl(
                  `${cinema.mall} ${cinema.address}`,
                  cinema.latitude,
                  cinema.longitude,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-zap hover:underline"
              >
                Open in Maps
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </div>

          {showTitles ? (
            <ul className="mt-3 space-y-4">
              {byTitle(times).map(([title, list]) => (
                <li key={title} className="flex gap-3">
                  <Poster
                    movie={list[0].movie}
                    href={`/movie/${list[0].movie.slug}?city=${cinema.city}`}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/movie/${list[0].movie.slug}?city=${cinema.city}`}
                      className="text-sm font-semibold text-white hover:text-zap"
                    >
                      {title}
                    </Link>
                    <TimeGrid times={list} onPick={setPicked} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <TimeGrid times={times} onPick={setPicked} />
          )}
        </section>
      ))}

      <ShowBookDrawer
        open={!!picked}
        onClose={() => setPicked(null)}
        show={
          picked
            ? {
                title: picked.movie.title,
                poster: picked.movie.poster_url || undefined,
                start_time: picked.start_time,
                mall: picked.cinema.mall,
                cinema_name: picked.cinema.name,
                chain: picked.cinema.chain,
                booking_url: picked.booking_direct_url,
                screen_type: picked.screen_type,
                price: picked.price,
              }
            : null
        }
      />
    </div>
  );
}

/** Small on purpose: the poster is for recognition, the times are the job. */
function Poster({ movie, href }: { movie: ShowtimeView["movie"]; href?: string }) {
  if (!movie.poster_url) return null;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={movie.poster_url}
      alt=""
      loading="lazy"
      className="h-[4.5rem] w-12 shrink-0 rounded-lg object-cover"
    />
  );
  return href ? (
    <Link href={href} tabIndex={-1} aria-hidden className="shrink-0">
      {img}
    </Link>
  ) : (
    img
  );
}

function byTitle(times: ShowtimeView[]) {
  const map = new Map<string, ShowtimeView[]>();
  for (const t of times) map.set(t.movie.title, [...(map.get(t.movie.title) ?? []), t]);
  return [...map.entries()];
}

/** Fixed-width cells so times and formats line up instead of ragging with the text. */
function TimeGrid({
  times,
  onPick,
}: {
  times: ShowtimeView[];
  onPick: (t: ShowtimeView) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-2">
      {times.map((t) => {
        // 2D is the default and every price is currently null, so a chip that says
        // "2D · —" only adds noise. Show a second line when it carries information.
        const meta = [t.screen_type === "2D" ? null : t.screen_type, t.price == null ? null : peso(t.price)]
          .filter(Boolean)
          .join(" · ");
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className="min-h-11 rounded-lg border border-white/15 bg-neutral-900 px-2 py-1.5 text-center hover:border-zap hover:text-zap"
          >
            <span className="block text-sm font-bold tabular-nums leading-tight">
              {formatClock(t.start_time)}
            </span>
            {meta && (
              <span className="block truncate text-[10px] font-medium uppercase tracking-wide text-zap">
                {meta}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pins origin to this mall, then opens Nearby → Restaurants. */
function EatNearMall({ cinema }: { cinema: CinemaRow }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (cinema.latitude && cinema.longitude) {
          writeOrigin(cinema.latitude, cinema.longitude);
        }
        const city = filterIdForCity(cinema.city);
        router.push(`/?city=${city}&category=restaurant`);
      }}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-white/70 hover:text-white hover:underline"
    >
      <Utensils className="h-3.5 w-3.5" aria-hidden />
      Eat nearby
    </button>
  );
}
