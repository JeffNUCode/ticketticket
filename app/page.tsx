import { cookies } from "next/headers";
import { Suspense } from "react";
import { LocationSelector } from "@/components/location-selector";
import { CategoryToggle } from "@/components/category-toggle";
import { DiscoverBoard } from "@/components/discover-board";
import { EventsBoard } from "@/components/events-board";
import { PlaceDirectory } from "@/components/place-directory";
import { Skeleton } from "@/components/ui/skeleton";
import { LOCATION_FILTERS, CITY_COOKIE, cityInFilter, cityLabel, hasChosenCity, parseCity } from "@/lib/cities";
import { getFilteredShowtimes, isoDate } from "@/lib/data";
import { loadEventsFile } from "@/lib/events-inventory";
import { loadPlaces } from "@/lib/places";
import {
  discoverTabCounts,
  discoverTabLabel,
  isEventTab,
  isPlaceTab,
  parseDiscoverTab,
  placesForTab,
} from "@/types/discover";
import { eventsForTab } from "@/types/events";
import { phNoon } from "@/lib/utils";
import type { CinemaChain, CitySlug, ScreenType } from "@/types/database";

export const revalidate = 300;

function SoftLocation({
  city,
  cities,
  chosen,
}: {
  city: ReturnType<typeof parseCity>;
  cities: CitySlug[];
  chosen: boolean;
}) {
  if (chosen) {
    return (
      <Suspense fallback={<Skeleton className="h-10 w-28 rounded-full" />}>
        <LocationSelector city={city} cities={cities} compact />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<Skeleton className="h-28 w-full" />}>
      <div className="panel w-full space-y-3 p-4 sm:max-w-md">
        <p className="font-display text-lg font-bold text-white">Where are you going?</p>
        <p className="text-sm text-white/70">
          Pick a region to sort what&apos;s near you. GPS is optional — or browse All for now.
        </p>
        <LocationSelector city={city} cities={cities} prominent />
      </div>
    </Suspense>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const str = (k: string) => (typeof searchParams[k] === "string" ? (searchParams[k] as string) : undefined);
  const cookie = cookies().get(CITY_COOKIE)?.value;
  const chosen = hasChosenCity(str("city"), cookie);
  const city = chosen ? parseCity(str("city"), cookie) : parseCity(str("city"), "all");
  const date = str("date") ?? isoDate();
  const chain = (str("chain") ?? "all") as CinemaChain | "all";
  const format = (str("format") ?? "all") as ScreenType | "all";
  const category = parseDiscoverTab(str("category"));
  const allCitySlugs = LOCATION_FILTERS.flatMap((f) => f.cities);
  const allEvents = await loadEventsFile();
  const allPlaces = loadPlaces();
  const counts = discoverTabCounts(allEvents, allPlaces);
  const where = city === "all" ? "nationwide" : cityLabel(city);
  // After a region is chosen, hubs scroll away so showtimes keep the viewport.
  const hubSticky = !chosen;

  if (isPlaceTab(category)) {
    const inRegion = allPlaces.filter((p) => city === "all" || cityInFilter(city, p.city));
    const forKind = placesForTab(inRegion, category);
    // Kind empty in this region → show all kinds here instead of a dead list.
    const unlockKinds = forKind.length === 0 && inRegion.length > 0;
    const list = unlockKinds ? inRegion : placesForTab(allPlaces, category);
    const title = unlockKinds ? "Nearby" : discoverTabLabel(category);

    return (
      <div className="space-y-4">
        <Suspense fallback={<Skeleton className="h-11 w-full" />}>
          <CategoryToggle active={category} counts={counts} sticky={hubSticky} />
        </Suspense>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="mt-1 text-sm text-white/70">
              {unlockKinds
                ? `No ${discoverTabLabel(category).toLowerCase()} in ${where} — showing everything nearby.`
                : city === "all"
                  ? "Nearest first across the Philippines."
                  : `Near ${cityLabel(city)}, nearest first.`}{" "}
              Open Maps or their site to book a table.
            </p>
          </div>
          <SoftLocation city={city} cities={allCitySlugs} chosen={chosen} />
        </div>
        <Suspense fallback={<Skeleton className="h-56 w-full" />}>
          <PlaceDirectory
            places={list}
            city={city}
            lockedKind={unlockKinds ? undefined : category}
          />
        </Suspense>
      </div>
    );
  }

  if (isEventTab(category)) {
    const filtered = eventsForTab(allEvents, category);
    const title = discoverTabLabel(category);

    return (
      <div className="space-y-4">
        <Suspense fallback={<Skeleton className="h-11 w-full" />}>
          <CategoryToggle active={category} counts={counts} sticky={hubSticky} />
        </Suspense>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="mt-1 text-sm text-white/70">
              {filtered.length > 0
                ? `Near ${where}.`
                : city === "all"
                  ? "Nothing listed yet."
                  : `Nothing listed near ${cityLabel(city)} — try All or another area.`}
            </p>
          </div>
          <SoftLocation city={city} cities={allCitySlugs} chosen={chosen} />
        </div>
        <Suspense fallback={<Skeleton className="h-56 w-full" />}>
          <EventsBoard events={filtered} city={city} categoryLabel={title} tab={category} />
        </Suspense>
      </div>
    );
  }

  const { showtimes, dates, cinemas, cities, chains, formats } = await getFilteredShowtimes({
    city,
    date,
    chain,
    format,
  });

  const when =
    date === isoDate()
      ? "today"
      : phNoon(date).toLocaleDateString("en-PH", { weekday: "long", month: "short", day: "numeric" });

  const locationCities = cities.length ? cities : allCitySlugs;

  return (
    <div className="space-y-4">
      <Suspense fallback={<Skeleton className="h-11 w-full" />}>
        <CategoryToggle active="movies" counts={counts} sticky={hubSticky} />
      </Suspense>
      {!chosen && <SoftLocation city={city} cities={locationCities} chosen={false} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Showtimes {when}</h1>
          <p className="mt-1 text-sm text-white/70">
            {showtimes.length > 0
              ? `Closest cinemas ${city === "all" ? "nationwide" : `in ${cityLabel(city)}`}. Tap a time to continue.`
              : city === "all"
                ? "No times left for this day."
                : `No times left in ${cityLabel(city)} for this day.`}
          </p>
        </div>
        {chosen && <SoftLocation city={city} cities={locationCities} chosen />}
      </div>

      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <DiscoverBoard
          city={city}
          date={date}
          dates={dates}
          chain={chain}
          format={format}
          chains={chains}
          formats={formats}
          showtimes={showtimes}
          cinemas={cinemas}
          query={str("q") ?? ""}
          dateRailTop={hubSticky ? "calc(4.5rem + 3.25rem)" : "4.5rem"}
        />
      </Suspense>
    </div>
  );
}
