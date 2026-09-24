"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CinemaSearch } from "@/components/cinema-search";
import { useOrigin } from "@/components/location-selector";
import { BookOnSite } from "@/components/book-on-site";
import { MallTimes } from "@/components/showtime-list";
import { matchesCinema } from "@/lib/ingest";
import { cn, localDateKey, phNoon } from "@/lib/utils";
import type { CinemaChain, CinemaRow, LocationFilterId, ScreenType } from "@/types/database";
import { groupByMall, nowShowing, type ShowtimeView } from "@/lib/group";

/** Malls shown before the list needs a deliberate "show everything". */
const PREVIEW_MALLS = 6;

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

export function DateRail({
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
  );
}

/** Tapping a poster narrows the times below it. Navigating away would cost the scroll position. */
function PosterRail({
  movies,
  picked,
  onPick,
}: {
  movies: ShowtimeView["movie"][];
  picked: string | null;
  onPick: (id: string | null) => void;
}) {
  return (
    <HRail
      prevLabel="Earlier films"
      nextLabel="More films"
      step={320}
      arrowClassName="h-24 w-9"
      className="gap-3"
    >
      {movies.map((m) => {
        const on = picked === m.id;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(on ? null : m.id)}
            className="press w-24 shrink-0 snap-start text-left sm:w-28"
          >
            {m.poster_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={m.poster_url}
                alt=""
                loading="lazy"
                className={cn(
                  "aspect-[2/3] w-full rounded-xl border-2 object-cover",
                  on ? "border-zap" : "border-ink",
                )}
              />
            ) : (
              <div className="aspect-[2/3] w-full rounded-xl border-2 border-ink bg-white/5" />
            )}
            <p
              className={cn(
                "mt-1.5 line-clamp-2 text-xs font-semibold leading-tight",
                on ? "text-zap" : "text-white/80",
              )}
            >
              {m.title}
            </p>
          </button>
        );
      })}
    </HRail>
  );
}

export function DiscoverBoard({
  city,
  date,
  dates,
  chain,
  format,
  chains,
  formats,
  showtimes,
  cinemas,
  query,
  /** When hubs aren't sticky, date rail sticks under the site header only. */
  dateRailTop = "calc(4.5rem+3.25rem)",
}: {
  city: LocationFilterId;
  date: string;
  dates: string[];
  chain: CinemaChain | "all";
  format: ScreenType | "all";
  chains: CinemaChain[];
  formats: ScreenType[];
  showtimes: ShowtimeView[];
  cinemas: CinemaRow[];
  query: string;
  dateRailTop?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [cinemaQ, setCinemaQ] = useState(query);
  const [showAll, setShowAll] = useState(false);
  const [film, setFilm] = useState<string | null>(null);
  const origin = useOrigin(city);

  function patch(next: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => p.set(k, v));
    router.push(`/?${p.toString()}`);
  }

  const matched = useMemo(
    () => showtimes.filter((s) => matchesCinema(s.cinema, cinemaQ)),
    [showtimes, cinemaQ],
  );
  const films = useMemo(() => nowShowing(matched), [matched]);
  const pickedFilm = films.find((m) => m.id === film);
  const inFilm = useMemo(
    () => (film ? matched.filter((s) => s.movie.id === film) : matched),
    [matched, film],
  );
  const malls = useMemo(() => groupByMall(inFilm, origin), [inFilm, origin]);
  const visible = showAll || cinemaQ || film ? malls : malls.slice(0, PREVIEW_MALLS);
  const shown = useMemo(
    () => inFilm.filter((s) => visible.some((m) => m.cinema.id === s.cinema.id)),
    [inFilm, visible],
  );

  const today = localDateKey();
  const nextDate = dates.find((d) => d > date);
  const filtered = chain !== "all" || format !== "all";
  const playingLabel =
    date === today
      ? "Playing nearby"
      : `Playing on ${phNoon(date).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}`;

  const filters = (chains.length > 1 || formats.length > 1) && (
    <details className="panel group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-2 text-sm font-semibold text-white/80">
        <span>Filters{filtered ? " · on" : ""}</span>
        <span className="text-xs text-white/60 group-open:hidden">Chain · format</span>
      </summary>
      <div className="space-y-3 border-t border-white/10 px-4 py-3">
        {chains.length > 1 && (
          <FilterRow label="Chain">
            <Chip active={chain === "all"} onClick={() => patch({ chain: "all" })}>
              All chains
            </Chip>
            {chains.map((c) => (
              <Chip key={c} active={chain === c} onClick={() => patch({ chain: c })}>
                {c}
              </Chip>
            ))}
          </FilterRow>
        )}
        {formats.length > 1 && (
          <FilterRow label="Format">
            <Chip active={format === "all"} onClick={() => patch({ format: "all" })}>
              All formats
            </Chip>
            {formats.map((f) => (
              <Chip key={f} active={format === f} onClick={() => patch({ format: f })}>
                {f}
              </Chip>
            ))}
          </FilterRow>
        )}
      </div>
    </details>
  );

  return (
    <div className="space-y-4">
      <div
        className="sticky z-10 -mx-4 border-b border-white/5 bg-neutral-950/90 px-2 py-2 backdrop-blur sm:px-3"
        style={{ top: dateRailTop }}
      >
        <DateRail dates={dates} date={date} onPick={(d) => patch({ date: d })} />
      </div>

      {showtimes.length === 0 ? (
        <EmptyDay
          date={date}
          today={today}
          nextDate={nextDate}
          filtered={filtered}
          onNext={(d) => patch({ date: d })}
          onClearFilters={() => patch({ chain: "all", format: "all" })}
          cinemas={cinemas}
          cinemaQ={cinemaQ}
        />
      ) : (
        <>
          {films.length > 0 && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="section-title">{playingLabel}</h2>
                {film && (
                  <button
                    type="button"
                    onClick={() => setFilm(null)}
                    className="press min-h-11 rounded-full border border-white/15 px-3 text-sm font-semibold text-white/70 hover:text-white"
                  >
                    All films
                  </button>
                )}
              </div>
              <PosterRail movies={films} picked={film} onPick={setFilm} />
              {pickedFilm && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <p className="text-white/70">
                    Showing <span className="font-semibold text-white">{pickedFilm.title}</span> — tap a
                    time below to book
                  </p>
                  <Link
                    href={`/movie/${pickedFilm.slug}?city=${city}`}
                    className="font-semibold text-white/55 underline-offset-2 hover:text-white hover:underline"
                  >
                    Film details
                  </Link>
                </div>
              )}
            </section>
          )}

          <CinemaSearch value={cinemaQ} onChange={setCinemaQ} />
          {filters}

          {malls.length === 0 ? (
            <NoMatchedCinema cinemaQ={cinemaQ} cinemas={cinemas} />
          ) : (
            <>
              <MallTimes showtimes={shown} showTitles={!film} origin={origin} />

              {!showAll && !cinemaQ && !film && malls.length > PREVIEW_MALLS && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="press panel min-h-11 w-full px-4 text-sm font-semibold text-white/80 hover:border-zap hover:text-zap"
                >
                  Show all {malls.length} cinemas
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function EmptyDay({
  date,
  today,
  nextDate,
  filtered,
  onNext,
  onClearFilters,
  cinemas,
  cinemaQ,
}: {
  date: string;
  today: string;
  nextDate?: string;
  filtered: boolean;
  onNext: (d: string) => void;
  onClearFilters: () => void;
  cinemas: CinemaRow[];
  cinemaQ: string;
}) {
  const label = phNoon(date).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" });
  const matched = cinemaQ
    ? cinemas.filter((c) => matchesCinema(c, cinemaQ)).slice(0, 6)
    : cinemas.slice(0, 6);

  return (
    <section className="space-y-4">
      <p className="text-sm text-white/70">
        {filtered
          ? `No screenings match those filters on ${label}.`
          : date === today
            ? "That's a wrap for today — every screening here has already started."
            : `No screenings listed for ${label} yet.`}
      </p>
      <div className="flex flex-wrap gap-2">
        {filtered && (
          <button
            type="button"
            onClick={onClearFilters}
            className="press min-h-11 rounded-full border-2 border-ink bg-zap px-4 font-display text-sm font-bold text-black"
          >
            Clear filters
          </button>
        )}
        {nextDate && (
          <button
            type="button"
            onClick={() => onNext(nextDate)}
            className="press min-h-11 rounded-full border-2 border-ink bg-zap px-4 font-display text-sm font-bold text-black"
          >
            See {phNoon(nextDate).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}
          </button>
        )}
      </div>
      <BookOnSite
        cinemas={matched}
        heading={matched.length === 1 ? `Check ${matched[0].mall}` : "Check the cinema’s site"}
        note="We don’t invent times. If a mall isn’t listed here, its schedule is still on their booking page."
      />
    </section>
  );
}

function NoMatchedCinema({ cinemaQ, cinemas }: { cinemaQ: string; cinemas: CinemaRow[] }) {
  const matched = cinemas.filter((c) => matchesCinema(c, cinemaQ)).slice(0, 6);
  if (matched.length === 0) {
    return (
      <p className="text-sm text-white/70">
        No cinema here matches “{cinemaQ}”. Clear the search to see the closest branches.
      </p>
    );
  }
  return (
    <BookOnSite
      cinemas={matched}
      heading="No times in the app for this cinema"
      note={`“${cinemaQ}” is in our directory, but we don’t have showtimes to show. Open their site to check what’s playing.`}
    />
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/60">{label}</p>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">{children}</div>
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
        "press min-h-11 shrink-0 whitespace-nowrap rounded-full px-3 text-sm font-semibold",
        active
          ? "border-2 border-ink bg-zap text-black"
          : "border border-white/15 text-white/70 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
