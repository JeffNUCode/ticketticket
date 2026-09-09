import { unstable_cache } from "next/cache";
import { runScrapers } from "./index";

/** ISR-style revalidation for scraper payloads (300s). Upgrade: write rows into showtimes via service role. */
export const getCachedScraperPayload = unstable_cache(runScrapers, ["scraper-payload"], {
  revalidate: 300,
  tags: ["showtimes"],
});
