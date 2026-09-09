import "./env";
import { tmdbConfigured, fetchNowPlayingPh } from "../lib/tmdb";

async function main() {
  if (!tmdbConfigured()) {
    console.log("skip: TMDB_API_KEY not set");
    return;
  }
  const movies = await fetchNowPlayingPh();
  if (movies.length === 0) throw new Error("TMDB now_playing PH returned 0");
  const missing = movies.filter((m) => !m.title || !m.slug);
  if (missing.length) throw new Error("TMDB rows missing title/slug");
  console.log(`ok ${movies.length} PH now-playing titles`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
