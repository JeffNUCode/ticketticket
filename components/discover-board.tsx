"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { cn, formatClock, localDateKey, peso, phNoon } from "@/lib/utils";
import type { CinemaChain, CinemaRow, CitySlug, LocalPromoRow, ScreenType } from "@/types/database";
import { groupByMall, type ShowtimeView } from "@/lib/group";

const CHAINS: (CinemaChain | "all")[] = [
  "all",
  "SM Cinema",
  "Ayala Malls",
  "Robinsons",
  "Megaworld",
];
const FORMATS: (ScreenType | "all")[] = ["all", "2D", "3D", "IMAX", "Director's Club"];

/** Dates interleaved with a month label wherever the month rolls over. */
function railItems(dates: string[]) {
  let month = "";
  return dates.flatMap((d) => {
    const label = phNoon(d).toLocaleDateString("en-PH", { month: "short" });
    if (label === month) return [{ kind: "day" as const, value: d }];
    month = label;
    return [
      { kind: "month" as const, value: label },
      { kind: "day" as const, value: d },
    ];
  });
}

function HRail({
  children,
  className,
  prevLabel,
  nextLabel,
  step = 240,
  alignPressed,
  arrowClassName = "h-11 w-9",
}: {
  children: ReactNode;
  className?: string;
  prevLabel: string;
  nextLabel: string;
  step?: number;
  alignPressed?: string;
  arrowClassName?: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function syncArrows() {
    const el = rail.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  useEffect(() => {
    if (!alignPressed) return;
    rail.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
    requestAnimationFrame(syncArrows);
  }, [alignPressed]);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    syncArrows();
    el.addEventListener("scroll", syncArrows, { passive: true });
    const ro = new ResizeObserver(syncArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncArrows);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={prevLabel}
        disabled={!canLeft}
        onClick={() => rail.current?.scrollBy({ left: -step, behavior: "smooth" })}
        className={cn(
          "press hidden shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 disabled:opacity-25 sm:flex",
          arrowClassName,
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div
        ref={rail}
        className={cn("no-scrollbar flex min-w-0 flex-1 snap-x overflow-x-auto", className)}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={nextLabel}
        disabled={!canRight}
        onClick={() => rail.current?.scrollBy({ left: step, behavior: "smooth" })}
        className={cn(
          "press hidden shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10 disabled:opacity-25 sm:flex",
          arrowClassName,
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function DateRail({
  dates,
  date,
  onPick,
}: {
  dates: string[];
  date: string;
  onPick: (d: string) => void;
}) {
  const items = useMemo(() => railItems(dates), [dates]);
  const today = localDateKey();

  return (
    <div className="sticky top-[4.5rem] z-20 -mx-4 border-b border-white/5 bg-neutral-950/85 px-2 py-2 backdrop-blur sm:px-3">
      <HRail prevLabel="Earlier dates" nextLabel="Later dates" alignPressed={date} className="gap-1.5">
        {items.map((item) =>
          item.kind === "month" ? (
            <span
              key={`m-${item.value}`}
              className="shrink-0 self-center px-1 text-[10px] font-bold uppercase tracking-widest text-white/35"
            >
              {item.value}
            </span>
          ) : (
            <button
              key={item.value}
              type="button"
              onClick={() => onPick(item.value)}
              aria-pressed={date === item.value}
              aria-label={phNoon(item.value).toLocaleDateString("en-PH", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              className={cn(
                "press w-14 shrink-0 snap-start rounded-2xl py-2 text-center",
                date === item.value
                  ? "bg-zap text-black ring-2 ring-inset ring-ink"
                  : "bg-white/[0.04] text-white/70 hover:bg-white/[0.08]",
              )}
            >
              <span className="block text-[10px] font-bold uppercase tracking-wide opacity-70">
                {item.value === today
                  ? "Today"
                  : phNoon(item.value).toLocaleDateString("en-PH", { weekday: "short" })}
              </span>
              <span className="block font-display text-lg font-extrabold leading-tight">
                {phNoon(item.value).getDate()}
              </span>
            </button>
          ),
        )}
      </HRail>
    </div>
  );
}

export function DiscoverBoard({
  city,
  date,
  dates,
  chain,
  genre,
  format,
  genres,
  showtimes,
  promos,
  cinemas,
}: {
  city: CitySlug;
  date: string;
  dates: string[];
  chain: CinemaChain | "all";
  genre: string;
  format: ScreenType | "all";
  genres: string[];
  showtimes: ShowtimeView[];
  promos: LocalPromoRow[];
  cinemas: CinemaRow[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [picked, setPicked] = useState<ShowtimeView | null>(null);

  function patch(next: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => p.set(k, v));
    router.push(`/?${p.toString()}`);
  }

  const grouped = useMemo(() => groupByMall(showtimes), [showtimes]);
  const movies = useMemo(() => {
    const map = new Map<string, ShowtimeView["movie"]>();
    showtimes.forEach((s) => map.set(s.movie.id, s.movie));
    return [...map.values()];
  }, [showtimes]);

  const extraFilters = chain !== "all" || format !== "all" || genre !== "all";

  return (
    <div className="space-y-6">
      <DateRail dates={dates} date={date} onPick={(d) => patch({ date: d })} />

      <details className="panel group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2 text-sm font-semibold text-white/80 [&::-webkit-details-marker]:hidden">
          <span>Filters{extraFilters ? " · on" : ""}</span>
          <span className="text-xs text-white/40 group-open:hidden">Chain · format · genre</span>
        </summary>
        <div className="space-y-3 border-t border-white/10 px-4 py-3">
          <FilterRow label="Chain">
            {CHAINS.map((c) => (
              <Chip key={c} active={chain === c} onClick={() => patch({ chain: c })}>
                {c === "all" ? "All chains" : c}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Format">
            {FORMATS.map((f) => (
              <Chip key={f} active={format === f} onClick={() => patch({ format: f })}>
                {f === "all" ? "All formats" : f}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Genre">
            <Chip active={genre === "all"} onClick={() => patch({ genre: "all" })}>
              All genres
            </Chip>
            {genres.map((g) => (
              <Chip key={g} active={genre === g} onClick={() => patch({ genre: g })}>
                {g}
              </Chip>
            ))}
          </FilterRow>
        </div>
      </details>

      {movies.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Now playing</h2>
          <div className="-mx-4 px-2 sm:px-3">
            <HRail
              prevLabel="Previous movies"
              nextLabel="More movies"
              step={280}
              className="snap-mandatory gap-3 pb-1"
              // Poster is 2:3, so w-28/w-32 tiles stand 10.5rem/12rem tall.
              arrowClassName="self-start h-[10.5rem] w-11 bg-white/[0.04] sm:h-48 [&_svg]:h-6 [&_svg]:w-6"
            >
              {movies.map((m) => (
                <Link
                  key={m.id}
                  href={`/movie/${m.slug}`}
                  className="w-28 shrink-0 snap-start sm:w-32"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.poster_url}
                    alt=""
                    className="aspect-[2/3] w-full rounded-xl object-cover"
                  />
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-white/90">
                    {m.title}
                  </p>
                </Link>
              ))}
            </HRail>
          </div>
        </section>
      )}

      {grouped.length === 0 ? (
        <OfficialCinemas
          cinemas={cinemas.filter((c) => chain === "all" || c.chain === chain)}
        />
      ) : (
        grouped.map(({ cinema, times }) => {
          const promo = promos.find((p) => p.cinema_id === cinema.id);
          return (
            <section key={cinema.id} className="panel p-4">
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                  {cinema.chain}
                </p>
                <h3 className="font-display text-xl font-bold text-white">{cinema.mall}</h3>
                <p className="text-sm text-white/50">{cinema.address}</p>
              </div>
              <ul className="space-y-4">
                {Object.entries(
                  times.reduce<Record<string, ShowtimeView[]>>((acc, t) => {
                    (acc[t.movie.title] ??= []).push(t);
                    return acc;
                  }, {}),
                ).map(([title, list]) => (
                  <li key={title}>
                    <Link
                      href={`/movie/${list[0].movie.slug}`}
                      className="text-sm font-semibold text-white hover:text-zap"
                    >
                      {title}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {list.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setPicked(t)}
                          className="min-h-11 min-w-[4.5rem] rounded-lg border border-white/15 bg-neutral-900 px-3 py-1.5 text-left tabular-nums hover:border-zap hover:text-zap"
                        >
                          <span className="block text-sm font-bold leading-none">
                            {formatClock(t.start_time)}
                          </span>
                          <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">
                            {t.screen_type} · {peso(t.price)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              {promo && (
                <aside className="mt-4 border-l-4 border-zap bg-zap/10 px-3 py-2.5 text-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zap">
                    Nearby offer
                  </p>
                  <p className="font-semibold text-white">{promo.business_name}</p>
                  <p className="mt-0.5 text-white/70">{promo.promo_text}</p>
                  {promo.offer_code && (
                    <p className="mt-1 font-mono text-xs font-bold text-zap">{promo.offer_code}</p>
                  )}
                </aside>
              )}
            </section>
          );
        })
      )}

      <Drawer open={!!picked} onOpenChange={(o) => !o && setPicked(null)} title="Book on official site">
        {picked && (
          <div className="space-y-4">
            <div className="panel p-4">
              <p className="font-display text-lg font-bold text-white">{picked.movie.title}</p>
              <p className="mt-1 text-sm text-white/80">
                {picked.screen_type} · {formatClock(picked.start_time)} · {peso(picked.price)}
              </p>
              <p className="mt-1 text-sm text-white/50">{picked.cinema.name}</p>
            </div>
            <p className="text-sm text-white/50">
              We don&apos;t sell tickets. This opens the cinema&apos;s booking page.
            </p>
            <Button variant="gold" size="lg" className="w-full" asChild>
              <a href={picked.booking_direct_url} target="_blank" rel="noopener noreferrer">
                <Ticket className="h-5 w-5" />
                Continue to {picked.cinema.chain}
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function OfficialCinemas({ cinemas }: { cinemas: CinemaRow[] }) {
  return (
    <section className="space-y-3">
      <p className="text-sm text-white/60">
        We don&apos;t have mall times in the database yet. These are official booking sites for
        cinemas near the city you picked.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {cinemas.map((c) => (
          <li key={c.id} className="panel p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
              {c.chain}
            </p>
            <p className="font-display text-lg font-bold text-white">{c.mall}</p>
            <p className="text-sm text-white/50">{c.address}</p>
            <a
              href={c.website_booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-zap hover:underline"
            >
              Book on {c.chain}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/40">{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "press min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-semibold",
        active
          ? "border-2 border-ink bg-zap text-black"
          : "border border-white/15 text-white/70 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
