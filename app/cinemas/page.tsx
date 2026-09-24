import { Suspense } from "react";
import { cookies } from "next/headers";
import { CinemaDirectory } from "@/components/cinema-directory";
import { LocationSelector } from "@/components/location-selector";
import { getCatalog } from "@/lib/data";
import { CITY_COOKIE, cityLabel, parseCity } from "@/lib/cities";
import { localDateKey } from "@/lib/utils";

export const revalidate = 300;

export default async function CinemasPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const city = parseCity(
    typeof searchParams.city === "string" ? searchParams.city : undefined,
    cookies().get(CITY_COOKIE)?.value,
  );
  const { cinemas, showtimes } = await getCatalog();
  const cities = [...new Set(cinemas.map((c) => c.city))];
  const today = localDateKey();
  const withShowtimes = [
    ...new Set(
      showtimes
        .filter((s) => localDateKey(new Date(s.start_time)) >= today)
        .map((s) => s.cinema_id),
    ),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Find your cinema</h1>
        <p className="mt-1 text-sm text-white/55">
          Search any branch. If we have times, open them here — otherwise jump to the cinema&apos;s
          own booking site. Nearest first
          {city === "all" ? "" : ` in ${cityLabel(city)}`}.
        </p>
      </div>
      <Suspense>
        <LocationSelector city={city} cities={cities} compact />
      </Suspense>
      <CinemaDirectory cinemas={cinemas} city={city} withShowtimes={withShowtimes} />
    </div>
  );
}
