import { Suspense } from "react";
import Link from "next/link";
import { DiscoverBoard } from "@/components/discover-board";
import { LocationSelector } from "@/components/location-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { cityLabel, parseCity } from "@/lib/cities";
import { genresFrom, getFilteredShowtimes, isoDate } from "@/lib/data";
import { SourceBanner } from "@/components/source-banner";
import type { CinemaChain, ScreenType } from "@/types/database";

export const revalidate = 300;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const city = parseCity(typeof searchParams.city === "string" ? searchParams.city : undefined);
  const date = typeof searchParams.date === "string" ? searchParams.date : isoDate();
  const chain = (typeof searchParams.chain === "string" ? searchParams.chain : "all") as
    | CinemaChain
    | "all";
  const genre = typeof searchParams.genre === "string" ? searchParams.genre : "all";
  const format = (typeof searchParams.format === "string" ? searchParams.format : "all") as
    | ScreenType
    | "all";

  const { showtimes, dates, promos, movies, cinemas, source } = await getFilteredShowtimes({
    city,
    date,
    chain,
    genre,
    format,
  });
  const featured = showtimes[0]?.movie ?? movies[0];

  return (
    <div className="space-y-6">
      {featured && (
        <section className="relative overflow-hidden rounded-2xl border-2 border-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={featured.backdrop_url}
            alt=""
            className="h-48 w-full object-cover sm:h-64"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/55 to-black/20" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-zap">
              {source.movies === "tmdb-ph" ? "In Philippine theaters" : `Now showing · ${cityLabel(city)}`}
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              {featured.title}
            </h1>
            <Link
              href={`/movie/${featured.slug}`}
              className="press mt-3 inline-flex min-h-11 items-center rounded-full border-2 border-ink bg-zap px-4 font-display text-sm font-bold text-black shadow-pop-sm"
            >
              {showtimes.length ? "See showtimes" : "Movie details"}
            </Link>
          </div>
        </section>
      )}

      <Suspense fallback={<Skeleton className="h-56 w-full" />}>
        <div className="space-y-6">
          <LocationSelector city={city} />
          <SourceBanner source={source} />
          <DiscoverBoard
            city={city}
            date={date}
            dates={dates}
            chain={chain}
            genre={genre}
            format={format}
            genres={genresFrom(movies)}
            showtimes={showtimes}
            promos={promos}
            cinemas={cinemas}
          />
        </div>
      </Suspense>
    </div>
  );
}
