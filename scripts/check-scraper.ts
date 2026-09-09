import { isScrapedShowtime } from "../lib/scrapers/types";
import { runScrapers } from "../lib/scrapers";

async function main() {
  const results = await runScrapers();
  const all = results.flatMap((r) => r.showtimes);
  const bad = all.filter((s) => !isScrapedShowtime(s));
  const errors = results.flatMap((r) => r.errors);
  if (bad.length) throw new Error(`invalid showtimes: ${bad.length}`);
  if (all.length === 0) throw new Error("scrapers returned zero showtimes");
  if (errors.length) throw new Error(errors.join("; "));
  const sources = new Set(results.map((r) => r.source));
  if (!sources.has("sm-cinema") || !sources.has("ayala-malls")) {
    throw new Error("missing expected scraper sources");
  }
  console.log(`ok ${all.length} showtimes from ${results.length} scrapers`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
