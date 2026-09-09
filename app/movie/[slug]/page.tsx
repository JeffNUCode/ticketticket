import Image from "next/image";
import { notFound } from "next/navigation";
import { NotifyButton } from "@/components/notify-button";
import { Trailer } from "@/components/trailer";
import { SourceBanner } from "@/components/source-banner";
import { getMovieBySlug, OFFICIAL_BOOKERS } from "@/lib/data";
import { formatClock, formatDay, peso } from "@/lib/utils";

export const revalidate = 300;

export default async function MoviePage({ params }: { params: { slug: string } }) {
  const data = await getMovieBySlug(params.slug);
  if (!data) notFound();
  const { movie, showtimes, reviews, source } = data;
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
          className="h-48 w-full object-cover sm:h-64"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/55 to-transparent" />
        <div className="absolute bottom-0 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/60">{movie.rating}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            {movie.title}
          </h1>
          {movie.original_title && movie.original_title !== movie.title && (
            <p className="mt-1 text-sm text-white/55">{movie.original_title}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-white/60">
        <span>{movie.duration_mins} min</span>
        <span aria-hidden>·</span>
        <span>{movie.release_date}</span>
        {movie.genres.map((g) => (
          <span key={g} className="rounded-full border border-white/15 px-2 py-0.5 text-xs">
            {g}
          </span>
        ))}
        {avg != null && <span className="font-semibold text-zap">{avg.toFixed(1)} / 5</span>}
      </div>

      <SourceBanner source={source} />

      <NotifyButton movieId={movie.id} title={movie.title} />

      <p className="text-base leading-relaxed text-white/80">{movie.synopsis}</p>

      {movie.cast.length > 0 && (
        <p className="text-sm text-white/70">
          <span className="font-semibold text-white">Cast </span>
          {movie.cast.join(", ")}
        </p>
      )}

      {movie.trailer_youtube_id && <Trailer youtubeId={movie.trailer_youtube_id} />}

      <section>
        <h2 className="section-title mb-3">Nearby showtimes</h2>
        {showtimes.length === 0 ? (
          <ul className="grid gap-2 sm:grid-cols-3">
            {OFFICIAL_BOOKERS.map((b) => (
              <li key={b.chain}>
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="panel flex min-h-11 items-center justify-between px-4 py-3 text-sm font-semibold hover:border-zap"
                >
                  {b.chain}
                  <span className="text-zap">Book</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="panel divide-y divide-white/10">
            {showtimes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-semibold text-white">{s.cinema.mall}</p>
                  <p className="text-xs text-white/45">{s.cinema.chain}</p>
                </div>
                <p className="tabular-nums text-sm text-white/80">
                  {formatDay(s.start_time)} {formatClock(s.start_time)}
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
                  {s.screen_type}
                </p>
                <p className="font-semibold text-white">{peso(s.price)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="section-title mb-3">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-white/50">No reviews yet.</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="panel p-4">
                <p className="text-sm font-bold text-zap">{r.rating}/5</p>
                <p className="mt-1 text-sm text-white/80">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
