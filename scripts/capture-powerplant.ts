/**
 * Captures Power Plant Cinema showtimes via Vista OData (therockwellist).
 *   npx tsx scripts/capture-powerplant.ts
 *   npx tsx scripts/capture-powerplant.ts --days=14
 *   npx tsx scripts/capture-powerplant.ts --only=alabang
 */
import "./env";
import type { Page } from "playwright-core";
import { SEED } from "../lib/seed";
import type { InventoryShow } from "../lib/inventory";
import {
  PP_CINEMA_IDS,
  PP_ODATA,
  PP_SITE,
  filterPpSessions,
  ppScreenType,
  ppShowtimeIso,
  type PpFilm,
  type PpSession,
} from "../lib/powerplant";
import { launchBrowser, UA } from "./browser";
import { createTitleMatcher } from "./match-title";
import { mergeAndWrite, type Touched } from "./inventory-io";

function arg(name: string, fallback: number) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function odata<T>(page: Page, path: string): Promise<T> {
  const res = await page.request.get(`${PP_ODATA}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok()) throw new Error(`${path} → ${res.status()}`);
  return res.json() as Promise<T>;
}

async function main() {
  const days = arg("days", 14);
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1]?.toLowerCase();

  const cinemas = SEED.cinemas.filter((c) => c.chain === "Power Plant");
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });

  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched = new Set<string>();

  try {
    // Boot on the public site the user named; OData is the same booker's feed.
    await page.goto(PP_SITE, { waitUntil: "domcontentloaded", timeout: 90_000 });

    const films = await odata<{ value: PpFilm[] }>(page, "/Films?$format=json");
    const sessions = await odata<{ value: PpSession[] }>(page, "/Sessions?$format=json");
    const titleById = new Map(films.value.map((f) => [f.ID, f.Title]));

    const inWindow = filterPpSessions(sessions.value ?? [], days);
    console.log(`${sessions.value?.length ?? 0} session(s) total, ${inWindow.length} in ${days}-day window`);

    const match = await createTitleMatcher();
    const byCinema = new Map<string, PpSession[]>();
    for (const s of inWindow) {
      const list = byCinema.get(s.CinemaId) ?? [];
      list.push(s);
      byCinema.set(s.CinemaId, list);
    }

    for (const [vistaId, slots] of byCinema) {
      const cinemaId = PP_CINEMA_IDS[vistaId];
      const cinema = cinemaId ? cinemas.find((c) => c.id === cinemaId) : undefined;
      if (!cinema) {
        console.warn(`unmapped Power Plant cinema ${vistaId}`);
        continue;
      }
      if (only && !`${cinema.id} ${cinema.mall} ${cinema.name}`.toLowerCase().includes(only)) continue;

      console.log(`\n${cinema.id} — Vista ${vistaId} (${slots.length} slot(s))`);
      for (const s of slots) {
        const billed = titleById.get(s.ScheduledFilmId)?.trim();
        if (!billed) continue;
        // Site appends "MTRCB-R13" etc. to some titles — strip for TMDB match, keep billed for display.
        const title = billed.replace(/\s+MTRCB[- ]?[A-Z0-9-]+$/i, "").trim() || billed;
        const start = ppShowtimeIso(s.Showtime);
        if (!start) continue;

        const movieId = await match(title);
        if (!movieId) {
          unmatched.add(billed);
          continue;
        }

        touched.push({ cinemaId: cinema.id, date: start.slice(0, 10) });
        rows.push({
          movie_id: movieId,
          title: billed,
          cinema_id: cinema.id,
          screen_type: ppScreenType(s.ScreenName, s.SessionAttributesNames),
          start_time: start,
          price: null,
          booking_direct_url: cinema.website_booking_url,
        });
      }
    }
  } finally {
    await browser.close();
  }

  if (unmatched.size) {
    console.warn(`\nskipped ${unmatched.size} title(s) with no TMDB match:`);
    [...unmatched].forEach((t) => console.warn(`  "${t}"`));
  }
  if (rows.length === 0) throw new Error("captured 0 showtimes");

  const total = await mergeAndWrite(rows, touched);
  console.log(`\ncaptured ${rows.length} showtimes across ${touched.length} cinema-day(s)`);
  console.log(`data/showtimes.json now holds ${total} rows`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
