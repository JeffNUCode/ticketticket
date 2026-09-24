/**
 * Captures Fisher Mall showtimes from fisherboxoffice.fishermall.com.ph.
 *   npx tsx scripts/capture-fisher.ts
 *   npx tsx scripts/capture-fisher.ts --days=14
 */
import "./env";
import type { Page } from "playwright-core";
import { SEED } from "../lib/seed";
import type { InventoryShow } from "../lib/inventory";
import {
  FISHER_BRANCH_IDS,
  FISHER_SITE,
  filterFisherDays,
  fisherDateToIso,
  fisherScreenType,
  fisherStartIso,
  parseFisherSchedules,
} from "../lib/fisher";
import { launchBrowser, UA } from "./browser";
import { createTitleMatcher } from "./match-title";
import { mergeAndWrite, type Touched } from "./inventory-io";

function arg(name: string, fallback: number) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function loadSchedules(page: Page) {
  // Endpoint 404s on a second fetch — capture the homepage's own XHR instead.
  const pending = page.waitForResponse(
    (r) => r.url().includes("/webservice/GetCinemaSchedules") && r.ok(),
    { timeout: 60_000 },
  );
  await page.goto(FISHER_SITE, { waitUntil: "networkidle", timeout: 90_000 });
  const res = await pending;
  return res.text();
}

async function main() {
  const days = arg("days", 14);
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1]?.toLowerCase();

  const cinemas = SEED.cinemas.filter((c) => c.chain === "Fisher Mall");
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });

  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched = new Set<string>();

  try {
    const branches = parseFisherSchedules(await loadSchedules(page));
    console.log(`${branches.length} branch(es) on Fisher feed`);

    const match = await createTitleMatcher();
    for (const branch of branches) {
      const cinemaId = FISHER_BRANCH_IDS[branch.BranchId];
      const cinema = cinemaId ? cinemas.find((c) => c.id === cinemaId) : undefined;
      if (!cinema) {
        console.warn(`unmapped Fisher branch ${branch.BranchId} ${branch.BranchName}`);
        continue;
      }
      if (only && !`${cinema.id} ${cinema.mall} ${cinema.name}`.toLowerCase().includes(only)) continue;

      console.log(`\n${cinema.id} — ${branch.BranchName}`);
      for (const movie of branch.Movies ?? []) {
        const title = movie.Title?.trim();
        if (!title) continue;

        const dateLabels = (movie.ScreeningDates ?? [])
          .map((d) => ({ label: d.Value, iso: fisherDateToIso(d.Value), cinemas: d.Cinemas ?? [] }))
          .filter((d) => d.iso);
        const keep = new Set(filterFisherDays(dateLabels.map((d) => d.iso!), days));
        const inWindow = dateLabels.filter((d) => keep.has(d.iso!));
        if (inWindow.length === 0) continue;

        const movieId = await match(title);
        if (!movieId) {
          unmatched.add(title);
          continue;
        }

        let slots = 0;
        for (const day of inWindow) {
          for (const screen of day.cinemas) {
            for (const t of screen.ScreeningTimes ?? []) {
              const start = fisherStartIso(day.label, t.Value);
              if (!start) continue;
              touched.push({ cinemaId: cinema.id, date: start.slice(0, 10) });
              rows.push({
                movie_id: movieId,
                title,
                cinema_id: cinema.id,
                screen_type: fisherScreenType(screen.Name),
                start_time: start,
                price: Number.isFinite(t.Price) ? t.Price : null,
                booking_direct_url: cinema.website_booking_url,
              });
              slots++;
            }
          }
        }
        if (slots) console.log(`    ${title}: ${slots} showtime(s)`);
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
