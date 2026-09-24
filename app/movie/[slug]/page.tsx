import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { LocationSelector } from "@/components/location-selector";
import { MovieShowtimes } from "@/components/movie-showtimes";
import { SaveButton } from "@/components/notify-button";
import { Trailer } from "@/components/trailer";
import { CITY_COOKIE, parseCity } from "@/lib/cities";
import { getMovieBySlug, OFFICIAL_BOOKERS } from "@/lib/data";

export const revalidate = 300;

export default async function MoviePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const city = parseCity(
    typeof searchParams.city === "string" ? searchParams.city : undefined,
    cookies().get(CITY_COOKIE)?.value ?? "all",
  );
  const data = await getMovieBySlug(params.slug, city);
  if (!data) notFound();
  const { movie, showtimes, cities, reviews } = data;
  const avg =
    reviews.length === 0 ? null : reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <article className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border-2 border-ink">
        <Image
          src={movie.backdrop_url}
          alt=""
          width={1600}
          height={900}
          className="h-40 w-full object-cover sm:h-56"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 sm:gap-4 sm:p-5">
          {movie.poster_url && (
            <Image
              src={movie.poster_url}
              alt=""
              width={500}
              height={750}
              className="hidden w-24 shrink-0 rounded-xl border-2 border-ink object-cover shadow-pop-sm sm:block sm:w-28"
            />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
              {movie.rating}
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              {movie.title}
            </h1>
            {movie.original_title && movie.original_title !== movie.title && (
              <p className="mt-1 text-sm text-white/55">{movie.original_title}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
        {movie.duration_mins != null && movie.duration_mins > 0 && (
          <>
            <span className="font-semibold text-white/80">{movie.duration_mins} minutes run</span>
            <span aria-hidden>·</span>
          </>
        )}
        <span>{movie.release_date}</span>
        {movie.genres.map((g) => (
          <span key={g} className="rounded-full border border-white/15 px-2 py-0.5 text-xs">
            {g}
          </span>
        ))}
        {avg != null && <span className="font-semibold text-zap">{avg.toFixed(1)} / 5</span>}
      </div>

      <MovieShowtimes city={city} showtimes={showtimes} bookers={OFFICIAL_BOOKERS} />

      <div className="flex flex-wrap items-center gap-2">
        <SaveButton
          movieId={movie.id}
          title={movie.title}
          slug={movie.slug}
          poster={movie.poster_url}
        />
        {cities.length > 0 && (
          <Suspense>
            <LocationSelector city={city} cities={cities} compact />
          </Suspense>
        )}
      </div>

      <p className="text-base leading-relaxed text-white/80">{movie.synopsis}</p>

      {movie.cast.length > 0 && (
        <p className="text-sm text-white/70">
          <span className="font-semibold text-white">Cast </span>
          {movie.cast.join(", ")}
        </p>
      )}

      {movie.trailer_youtube_id && <Trailer youtubeId={movie.trailer_youtube_id} />}

      {reviews.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Reviews</h2>
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="panel p-4">
                <p className="text-sm font-bold text-zap">{r.rating}/5</p>
                <p className="mt-1 text-sm text-white/80">{r.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
