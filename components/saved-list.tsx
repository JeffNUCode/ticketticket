"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ticket } from "lucide-react";
import { EventBookDrawer, EventPoster, type EventHandoff } from "@/components/event-handoff";
import { ShowBookDrawer, type ShowHandoff } from "@/components/show-handoff";
import { cityLabel } from "@/lib/cities";
import { formatClock, formatDay, localDateKey } from "@/lib/utils";
import type { NextShow } from "@/lib/group";
import { useWatchlist, type SavedEvent, type SavedMovie } from "@/lib/watchlist";
import type { LocationFilterId } from "@/types/database";

export function SavedList({
  city,
  next,
}: {
  city: LocationFilterId;
  /** movie id -> its soonest screening in this city. */
  next: Record<string, NextShow>;
}) {
  const { movies, events, toggle, toggleEvent } = useWatchlist();
  const [eventHandoff, setEventHandoff] = useState<EventHandoff | null>(null);
  const [showHandoff, setShowHandoff] = useState<ShowHandoff | null>(null);

  const movieRows = useMemo(() => {
    return [...movies].sort((a, b) => {
      const ta = next[a.movieId]?.start_time ?? "9999";
      const tb = next[b.movieId]?.start_time ?? "9999";
      return ta.localeCompare(tb) || a.title.localeCompare(b.title);
    });
  }, [movies, next]);

  const eventRows = useMemo(() => {
    return [...events].sort((a, b) => (a.when ?? "9999").localeCompare(b.when ?? "9999"));
  }, [events]);

  if (movies.length === 0 && events.length === 0) {
    return (
      <div className="panel space-y-3 p-5">
        <p className="text-sm text-white/70">Nothing saved yet on this phone.</p>
        <p className="text-xs text-white/50">Saved stays on this device only — clearing site data removes it.</p>
        <Link
          href={`/?city=${city}`}
          className="press inline-flex min-h-11 items-center rounded-full border-2 border-ink bg-zap px-4 font-display text-sm font-bold text-black"
        >
          Browse near you
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-white/50">Saved on this phone only.</p>

      {movieRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Movies</h2>
          <ul className="space-y-2">
            {movieRows.map((s) => (
              <MovieRow
                key={s.movieId}
                s={s}
                city={city}
                show={next[s.movieId]}
                onBook={(h) => setShowHandoff(h)}
                onRemove={() => toggle(s)}
              />
            ))}
          </ul>
        </section>
      )}

      {eventRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Events</h2>
          <ul className="space-y-2">
            {eventRows.map((s) => (
              <EventRow
                key={s.eventId}
                s={s}
                onOpen={() =>
                  setEventHandoff({
                    title: s.title,
                    bookingUrl: s.bookingUrl,
                    poster: s.poster,
                    venue: s.venue,
                    when: s.when,
                  })
                }
                onRemove={() => toggleEvent(s)}
              />
            ))}
          </ul>
        </section>
      )}

      <EventBookDrawer
        event={eventHandoff}
        open={!!eventHandoff}
        onClose={() => setEventHandoff(null)}
      />
      <ShowBookDrawer show={showHandoff} open={!!showHandoff} onClose={() => setShowHandoff(null)} />
    </div>
  );
}

function MovieRow({
  s,
  city,
  show,
  onBook,
  onRemove,
}: {
  s: SavedMovie;
  city: LocationFilterId;
  show?: NextShow;
  onBook: (h: ShowHandoff) => void;
  onRemove: () => void;
}) {
  const href = `/movie/${s.slug}?city=${city}`;
  return (
    <li className="panel flex flex-wrap items-center gap-3 p-3">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        {s.poster && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.poster}
            alt=""
            loading="lazy"
            className="h-[4.5rem] w-12 shrink-0 rounded-lg object-cover"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-white">{s.title}</span>
          {show ? (
            <span className="mt-0.5 block truncate text-sm text-zap">
              {isToday(show.start_time) ? "Today" : formatDay(show.start_time)}{" "}
              {formatClock(show.start_time)}
              <span className="text-white/60"> · {show.mall}</span>
            </span>
          ) : (
            <span className="mt-0.5 block text-sm text-white/60">
              No times in {cityLabel(city)} —{" "}
              <Link href={`/?city=all`} className="underline hover:text-white">
                try All
              </Link>
            </span>
          )}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        {show ? (
          <button
            type="button"
            onClick={() =>
              onBook({
                title: s.title,
                poster: s.poster,
                start_time: show.start_time,
                mall: show.mall,
                cinema_name: show.cinema_name,
                chain: show.chain,
                booking_url: show.booking_url,
                screen_type: show.screen_type,
                price: show.price,
              })
            }
            className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink bg-zap px-3 font-display text-sm font-bold text-black"
          >
            <Ticket className="h-4 w-4" aria-hidden />
            Book
          </button>
        ) : (
          <Link
            href={href}
            className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/15 px-3 text-sm font-semibold text-white/80 hover:text-white"
          >
            Open
          </Link>
        )}
        <button
          type="button"
          aria-label={`Remove ${s.title}`}
          className="min-h-11 rounded-full px-3 text-sm text-white/60 hover:text-white"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function EventRow({
  s,
  onOpen,
  onRemove,
}: {
  s: SavedEvent;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="panel flex flex-wrap items-center gap-3 p-3">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <EventPoster src={s.poster} className="h-[4.5rem] w-12" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-white">{s.title}</span>
          <span className="mt-0.5 block truncate text-sm text-white/60">
            {s.when ? `${s.when} · ` : ""}
            {s.venue || "Official tickets"}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="press inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink bg-zap px-3 font-display text-sm font-bold text-black"
        >
          <Ticket className="h-4 w-4" aria-hidden />
          Get tickets
        </button>
        <button
          type="button"
          aria-label={`Remove ${s.title}`}
          className="min-h-11 rounded-full px-3 text-sm text-white/60 hover:text-white"
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function isToday(iso: string) {
  return localDateKey(new Date(iso)) === localDateKey();
}
