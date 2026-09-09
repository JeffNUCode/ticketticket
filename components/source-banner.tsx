import type { CatalogSource } from "@/lib/data";

const MOVIE_LABEL: Record<CatalogSource["movies"], string> = {
  "tmdb-ph": "Titles: TMDB now playing (PH)",
  supabase: "Titles: database",
  seed: "Titles: demo seed — not today’s bill",
};

const TIME_LABEL: Record<CatalogSource["showtimes"], string> = {
  supabase: "Times: database",
  file: "Times: data/showtimes.json",
  seed: "Times: demo seed — not cinema schedules",
  none: "Times: not ingested. Book on the chain’s site.",
};

export function SourceBanner({ source }: { source: CatalogSource }) {
  return (
    <p className="text-xs text-white/45" role="status">
      {MOVIE_LABEL[source.movies]} · {TIME_LABEL[source.showtimes]}
      {source.movies === "tmdb-ph" && (
        <>
          {" "}
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </>
      )}
    </p>
  );
}
