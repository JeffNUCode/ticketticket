"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { CinemaSearch } from "@/components/cinema-search";
import { useOrigin } from "@/components/location-selector";
import { cityInFilter, cityLabel } from "@/lib/cities";
import { matchesCinema } from "@/lib/ingest";
import { haversineKm, mapsSearchUrl, cn } from "@/lib/utils";
import type { CinemaRow, CitySlug, LocationFilterId } from "@/types/database";

const PAGE_SIZE = 24;

export function CinemaDirectory({
  cinemas,
  city,
  withShowtimes = [],
}: {
  cinemas: CinemaRow[];
  city: LocationFilterId;
  /** Cinema ids that have at least one upcoming row in inventory. */
  withShowtimes?: string[];
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const live = useMemo(() => new Set(withShowtimes), [withShowtimes]);
  const origin = useOrigin(city);

  useEffect(() => {
    setPage(1);
  }, [city]);

  const list = useMemo(() => {
    return cinemas
      .filter((c) => city === "all" || cityInFilter(city, c.city))
      .filter((c) => matchesCinema(c, q))
      .sort((a, b) => {
        if (origin) {
          const d =
            haversineKm(origin, { lat: a.latitude, lng: a.longitude }) -
            haversineKm(origin, { lat: b.latitude, lng: b.longitude });
          if (d !== 0) return d;
        }
        return a.mall.localeCompare(b.mall);
      });
  }, [cinemas, city, q, origin]);

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const groups = slice.reduce<{ city: CitySlug; items: CinemaRow[] }[]>((acc, c) => {
    const last = acc[acc.length - 1];
    if (last?.city === c.city) last.items.push(c);
    else acc.push({ city: c.city, items: [c] });
    return acc;
  }, []);

  function go(next: number) {
    setPage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function search(value: string) {
    setQ(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <CinemaSearch value={q} onChange={search} />

      {list.length === 0 ? (
        <p className="text-sm text-white/50">No cinemas match “{q}”.</p>
      ) : (
        <>
          <p className="text-xs text-white/55">
            {list.length} cinema{list.length === 1 ? "" : "s"}
            {" · nearest first"}
            {pages > 1 && ` · page ${current} of ${pages}`}
          </p>

          {groups.map((group) => (
            <section key={group.city}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/45">
                {cityLabel(group.city)}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {group.items.map((c) => {
                  const hasTimes = live.has(c.id);
                  return (
                    <li key={c.id} className="panel flex h-full flex-col p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                        {c.chain}
                      </p>
                      <p className="font-display text-lg font-bold text-white">{c.mall}</p>
                      <p className="text-sm text-white/50">{c.address}</p>
                      {!hasTimes && (
                        <p className="mt-2 text-xs text-white/45">
                          No times in the app yet — check their booking site.
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-3">
                        {hasTimes ? (
                          <Link
                            href={`/?city=${c.city}&q=${encodeURIComponent(c.mall)}`}
                            className="inline-flex min-h-11 items-center text-sm font-semibold text-zap hover:underline"
                          >
                            See showtimes
                          </Link>
                        ) : (
                          <Link
                            href={`/?city=${c.city}&q=${encodeURIComponent(c.mall)}`}
                            className="inline-flex min-h-11 items-center text-sm font-semibold text-white/55 hover:text-white hover:underline"
                          >
                            Search in app
                          </Link>
                        )}
                        <a
                          href={c.website_booking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-zap hover:underline"
                        >
                          {hasTimes ? "Book on site" : "Open cinema site"}
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                        <a
                          href={mapsSearchUrl(`${c.mall} ${c.address}`, c.latitude, c.longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-zap hover:underline"
                        >
                          Open in Maps
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {pages > 1 && (
            <nav
              aria-label="Cinema pages"
              className="sticky bottom-16 z-10 flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/10 bg-neutral-950/95 py-2 backdrop-blur md:static md:bottom-auto md:border-0 md:bg-transparent md:py-0 md:backdrop-blur-none"
            >
              <PageButton
                label="Previous page"
                disabled={current === 1}
                onClick={() => go(current - 1)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </PageButton>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <PageButton
                  key={n}
                  label={`Page ${n}`}
                  active={n === current}
                  onClick={() => go(n)}
                >
                  {n}
                </PageButton>
              ))}
              <PageButton
                label="Next page"
                disabled={current === pages}
                onClick={() => go(current + 1)}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </PageButton>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function PageButton({
  label,
  children,
  onClick,
  disabled,
  active,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "press flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-semibold",
        active
          ? "border-2 border-ink bg-zap text-black"
          : "border border-white/15 text-white/70 hover:text-white disabled:opacity-30",
      )}
    >
      {children}
    </button>
  );
}
