import type { CinemaChain, ScreenType } from "@/types/database";

/** Unified scraper output. Maps 1:1 onto showtimes + cinema identity. */
export type ScrapedShowtime = {
  movieTitle: string;
  cinemaName: string;
  chain: CinemaChain;
  city: string;
  mall: string;
  screenType: ScreenType;
  startTime: string;
  price: number | null;
  bookingUrl: string;
};

export type ScraperResult = {
  source: string;
  fetchedAt: string;
  showtimes: ScrapedShowtime[];
  errors: string[];
};

export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
];

export function rotateUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function isScrapedShowtime(row: unknown): row is ScrapedShowtime {
  if (!row || typeof row !== "object") return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.movieTitle === "string" &&
    typeof r.cinemaName === "string" &&
    typeof r.chain === "string" &&
    typeof r.screenType === "string" &&
    typeof r.startTime === "string" &&
    typeof r.bookingUrl === "string" &&
    (r.price === null || typeof r.price === "number")
  );
}
