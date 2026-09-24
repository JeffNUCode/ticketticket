"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Heart, Ticket } from "lucide-react";
import {
  EventBookDrawer,
  EventPoster,
  sellerHost,
} from "@/components/event-handoff";
import { useOrigin } from "@/components/location-selector";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/lib/watchlist";
import { cityInFilter } from "@/lib/cities";
import { haversineKm, cn } from "@/lib/utils";
import type { CitySlug, LocationFilterId } from "@/types/database";
import { ticketStatusLabel, type GoSeeEvent } from "@/types/events";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function dayKey(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  } catch {
    return iso.slice(0, 10);
  }
}

function dayLabel(key: string) {
  try {
    return new Date(`${key}T12:00:00+08:00`).toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  } catch {
    return key;
  }
}

function SaveEventButton({ evt }: { evt: GoSeeEvent }) {
  const { hasEvent, toggleEvent } = useWatchlist();
  const on = hasEvent(evt.id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${evt.title} from saved` : `Save ${evt.title}`}
      onClick={(e) => {
        e.stopPropagation();
        toggleEvent({
          kind: "event",
          eventId: evt.id,
          title: evt.title,
          bookingUrl: evt.booking_url,
          poster: evt.poster_url || undefined,
          venue: evt.venue.name,
          when: evt.schedules[0]?.start_time
            ? formatWhen(evt.schedules[0].start_time)
            : undefined,
        });
      }}
      className="press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 text-white/70 hover:text-white"
    >
      <Heart className={cn("h-4 w-4", on && "fill-zap text-zap")} aria-hidden />
    </button>
  );
}

export function EventsBoard({
  events,
  city,
  categoryLabel,
  tab,
}: {
  events: GoSeeEvent[];
  city: LocationFilterId;
  categoryLabel: string;
  /** Fine Live tab id for recovery links (e.g. concerts). */
  tab?: string;
}) {
  const origin = useOrigin(city);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<GoSeeEvent | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = events.filter((e) => {
      if (city !== "all" && !cityInFilter(city, e.venue.city as CitySlug)) return false;
      if (!needle) return true;
      return (
        e.title.toLowerCase().includes(needle) ||
        e.venue.name.toLowerCase().includes(needle) ||
        (e.subtitle_or_performer || "").toLowerCase().includes(needle)
      );
    });
    return list.sort((a, b) => {
      if (!origin) {
        return (a.schedules[0]?.start_time ?? "").localeCompare(b.schedules[0]?.start_time ?? "");
      }
      const da = haversineKm(origin, { lat: a.venue.lat, lng: a.venue.lng });
      const db = haversineKm(origin, { lat: b.venue.lat, lng: b.venue.lng });
      return da - db || (a.schedules[0]?.start_time ?? "").localeCompare(b.schedules[0]?.start_time ?? "");
    });
  }, [events, origin, q, city]);

  const groups = useMemo(() => {
    const map = new Map<string, GoSeeEvent[]>();
    for (const e of sorted) {
      const key = dayKey(e.schedules[0]?.start_time ?? e.updated_at);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sorted]);

  if (events.length === 0) {
    return (
      <div className="panel space-y-4 p-5">
        <p className="text-sm text-white/70">
          Nothing listed for {categoryLabel.toLowerCase()} yet. Try Movies for tonight, or check back
          soon.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/?city=${city}`}
            className="press inline-flex min-h-11 items-center rounded-full border-2 border-ink bg-zap px-4 font-display text-sm font-bold text-black"
          >
            See movie showtimes
          </Link>
          <a
            href="https://smtickets.com"
            target="_blank"
            rel="noopener noreferrer"
            className="press inline-flex min-h-11 items-center gap-1 rounded-full border border-white/15 px-4 text-sm font-semibold text-white/80 hover:text-white"
          >
            SM Tickets
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Search events or venues</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or venue"
          className="min-h-11 w-full rounded-full border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/45 focus:border-zap focus:outline-none"
        />
      </label>

      {sorted.length === 0 ? (
        <div className="panel space-y-3 p-5">
          <p className="text-sm text-white/70">
            {q
              ? `No ${categoryLabel.toLowerCase()} match “${q}”.`
              : city === "all"
                ? `No ${categoryLabel.toLowerCase()} to show right now.`
                : `No ${categoryLabel.toLowerCase()} near this area.`}
          </p>
          <div className="flex flex-wrap gap-2">
            {!q && city !== "all" && (
              <Link
                href={`/?city=all${tab ? `&category=${tab}` : ""}`}
                className="press inline-flex min-h-11 items-center rounded-full border-2 border-ink bg-zap px-4 font-display text-sm font-bold text-black"
              >
                Try All regions
              </Link>
            )}
            <Link
              href={`/?city=${city}`}
              className="press inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 text-sm font-semibold text-white/80 hover:text-white"
            >
              See movie showtimes
            </Link>
            {!q && (
              <a
                href="https://smtickets.com"
                target="_blank"
                rel="noopener noreferrer"
                className="press inline-flex min-h-11 items-center gap-1 rounded-full border border-white/15 px-4 text-sm font-semibold text-white/80 hover:text-white"
              >
                SM Tickets
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([key, rows]) => (
            <section key={key} className="space-y-3">
              <h2 className="section-title text-base text-white/80">{dayLabel(key)}</h2>
              <ul className="space-y-3">
                {rows.map((evt) => {
                  const start = evt.schedules[0];
                  const status = ticketStatusLabel(start?.ticket_status);
                  const km =
                    origin && Number.isFinite(evt.venue.lat)
                      ? haversineKm(origin, { lat: evt.venue.lat, lng: evt.venue.lng })
                      : null;
                  const expanded = openId === evt.id;
                  return (
                    <li key={evt.id} className="panel p-3">
                      <div className="flex gap-3">
                        <EventPoster src={evt.poster_url} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-base font-semibold text-white">{evt.title}</h3>
                              {evt.subtitle_or_performer && (
                                <p className="mt-0.5 truncate text-sm text-white/70">
                                  {evt.subtitle_or_performer}
                                </p>
                              )}
                              <p className="mt-0.5 truncate text-sm text-white/70">
                                {evt.venue.name}
                                {km != null
                                  ? ` · ${km < 10 ? km.toFixed(1) : Math.round(km)} km`
                                  : ""}
                              </p>
                              {start?.start_time && (
                                <p className="mt-1 text-sm font-medium text-white">
                                  {formatWhen(start.start_time)}
                                  {start.screen_or_hall ? ` · ${start.screen_or_hall}` : ""}
                                </p>
                              )}
                              <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs font-semibold uppercase tracking-wide text-zap">
                                {status && <span>{status}</span>}
                                {start?.price_range && <span>{start.price_range}</span>}
                              </p>
                            </div>
                            <SaveEventButton evt={evt} />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              variant="gold"
                              size="sm"
                              className="min-h-11"
                              onClick={() => setPicked(evt)}
                            >
                              <Ticket className="h-4 w-4" aria-hidden />
                              Get tickets
                            </Button>
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() => setOpenId(expanded ? null : evt.id)}
                              className="press min-h-11 rounded-full border border-white/15 px-3 text-sm font-semibold text-white/70 hover:text-white"
                            >
                              {expanded ? "Less" : "Details"}
                            </button>
                          </div>
                          {expanded && (
                            <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-sm text-white/70">
                              {evt.venue.address && <p>{evt.venue.address}</p>}
                              {evt.schedules.length > 1 && (
                                <ul className="space-y-1">
                                  {evt.schedules.map((s, i) => (
                                    <li key={`${evt.id}-${i}`}>
                                      {formatWhen(s.start_time)}
                                      {s.screen_or_hall ? ` · ${s.screen_or_hall}` : ""}
                                      {s.price_range ? ` · ${s.price_range}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <p className="text-white/60">
                                Seats and price on {sellerHost(evt.booking_url)}.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <EventBookDrawer
        open={!!picked}
        onClose={() => setPicked(null)}
        event={
          picked
            ? {
                title: picked.title,
                bookingUrl: picked.booking_url,
                poster: picked.poster_url || undefined,
                venue: picked.venue.name,
                when: picked.schedules[0]?.start_time
                  ? formatWhen(picked.schedules[0].start_time)
                  : undefined,
                subtitle: picked.subtitle_or_performer,
              }
            : null
        }
      />
    </div>
  );
}
