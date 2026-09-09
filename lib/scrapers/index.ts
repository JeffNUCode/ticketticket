import { AyalaMallsScraper } from "./ayala-malls";
import { SmCinemaScraper } from "./sm-cinema";
import type { ScraperResult } from "./types";

export { BaseScraper } from "./base";
export type { ScrapedShowtime, ScraperResult } from "./types";

export const SCRAPERS = [new SmCinemaScraper(), new AyalaMallsScraper()];

export async function runScrapers(): Promise<ScraperResult[]> {
  const settled = await Promise.allSettled(SCRAPERS.map((s) => s.scrape()));
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          source: SCRAPERS[i].source,
          fetchedAt: new Date().toISOString(),
          showtimes: [],
          errors: [String(r.reason)],
        },
  );
}
