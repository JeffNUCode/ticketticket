/**
 * Captures Robinsons showtimes via robinsonsmovieworld.com webservices.
 *
 * Needs a real browser session — bare fetch 404s. Flow per branch:
 *   getmovieswithdetailsbybranch → GetScreeningDetailsList → getschedulesbybranchandmovie
 *
 *   npx tsx scripts/capture-robinsons.ts
 *   npx tsx scripts/capture-robinsons.ts --days=7
 *   npx tsx scripts/capture-robinsons.ts --only=dasma
 */
import "./env";
import { readFileSync } from "fs";
import path from "path";
import type { Page } from "playwright-core";
import { SEED } from "../lib/seed";
import type { InventoryShow } from "../lib/inventory";
import type { CinemaRow } from "../types/database";
import {
  ROB_SITE,
  dotNetToPhIso,
  filterRobDates,
  parseRobJson,
  parseRobSchedules,
  resolveRobCinemaId,
  robScheduleDate,
  robScreenType,
  type RobBranch,
  type RobMovie,
} from "../lib/rob";
import { launchBrowser, UA } from "./browser";
import { createTitleMatcher } from "./match-title";
import { mergeAndWrite, type Touched } from "./inventory-io";

function arg(name: string, fallback: number) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const ROB_BOOT = readFileSync(path.join(process.cwd(), "scripts/rob-boot.js"), "utf8");

/** In-page POST — ASP.NET webservices reject server-side fetch without the site session. */
async function robPost(page: Page, apiPath: string) {
  return page.evaluate((p) => (window as { __robPost: (s: string) => Promise<string> }).__robPost(p), apiPath);
}

async function boot(page: Page) {
  await page.addInitScript({ content: ROB_BOOT });
  await page.goto(`${ROB_SITE}/cinema/nowshowing`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForFunction(() => Boolean((window as { $?: unknown }).$), { timeout: 30_000 });
}

async function loadBranches(page: Page) {
  const raw = await robPost(page, "/webservice/getbranches");
  const body = parseRobJson<{ BranchList: RobBranch[] }>(raw);
  return body.BranchList ?? [];
}

function mapBranches(branches: RobBranch[], cinemas: CinemaRow[]) {
  const rob = cinemas.filter((c) => c.chain === "Robinsons");
  const mapped: { branch: RobBranch; cinema: CinemaRow }[] = [];
  const missed: string[] = [];
  const used = new Set<string>();
  for (const branch of branches) {
    const id = resolveRobCinemaId(branch.Branch_Name, rob);
    const cinema = id ? rob.find((c) => c.id === id) : undefined;
    if (cinema && !used.has(cinema.id)) {
      used.add(cinema.id);
      mapped.push({ branch, cinema });
    } else if (!cinema) {
      missed.push(branch.Branch_Name);
    }
  }
  return { mapped, missed };
}

async function loadBranchMovies(page: Page, branchKey: number, branchName: string) {
  await page.evaluate((pair) => {
    sessionStorage.setItem(
      "selectedBranchName",
      JSON.stringify({ branchName: pair[0], branchKey: pair[1], isFromVip: false }),
    );
  }, [branchName, branchKey] as [string, number]);
  const raw = await robPost(page, `/webservice/getmovieswithdetailsbybranch?branchKey=${branchKey}`);
  const parsed = parseRobJson<RobMovie[] | { Movies?: RobMovie[] }>(raw);
  if (Array.isArray(parsed)) return parsed;
  return parsed.Movies ?? [];
}

async function captureBranch(
  page: Page,
  branch: RobBranch,
  cinema: CinemaRow,
  days: number,
  match: (title: string) => Promise<string | null>,
) {
  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched = new Set<string>();
  const book = cinema.website_booking_url;

  const movies = await loadBranchMovies(page, branch.Branch_Key, branch.Branch_Name);
  console.log(`  ${movies.length} film(s) on branch feed`);

  for (const movie of movies) {
    const title = movie.Movie_Name?.trim();
    if (!title) continue;

    const screeningRaw = await robPost(
      page,
      `/webservice/GetScreeningDetailsList?branchKey=${branch.Branch_Key}&movieName=${encodeURIComponent(title)}`,
    );
    const screening = parseRobJson<{ Data?: { ScreeningDate: string; MovieCode: string; MovieFormat: string }[] }>(
      screeningRaw,
    );
    const dates = filterRobDates((screening.Data ?? []).map((d) => d.ScreeningDate), days);
    if (dates.length === 0) continue;

    const movieId = await match(title);
    if (!movieId) {
      unmatched.add(title);
      continue;
    }

    let slots = 0;
    for (const row of screening.Data ?? []) {
      if (!dates.includes(row.ScreeningDate)) continue;
      const movieDate = robScheduleDate(row.ScreeningDate);
      if (!movieDate || !row.MovieCode) continue;

      let schedRaw: string;
      try {
        schedRaw = await robPost(
          page,
          `/webservice/getschedulesbybranchandmovie?movieDate=${movieDate}&branchId=${branch.Branch_Key}&movieCode=${row.MovieCode}`,
        );
      } catch {
        continue;
      }
      if (schedRaw.startsWith("<!DOCTYPE")) continue;

      for (const slot of parseRobSchedules(schedRaw)) {
        const start = dotNetToPhIso(slot.startTime);
        if (!start) continue;
        const day = start.slice(0, 10);
        touched.push({ cinemaId: cinema.id, date: day });
        rows.push({
          movie_id: movieId,
          title,
          cinema_id: cinema.id,
          screen_type: robScreenType(row.MovieFormat, slot.screeningType),
          start_time: start,
          price: slot.price,
          booking_direct_url: book,
        });
        slots++;
      }
    }
    if (slots > 0) console.log(`    ${title}: ${slots} showtime(s)`);
  }

  return { rows, touched, unmatched: [...unmatched] };
}

async function main() {
  const days = arg("days", 7);
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1]?.toLowerCase();

  const cinemas = SEED.cinemas.filter((c) => c.chain === "Robinsons");
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });

  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched: string[] = [];

  try {
    await boot(page);
    const { mapped, missed } = mapBranches(await loadBranches(page), cinemas);
    if (missed.length) {
      console.warn(`unmapped branches (${missed.length}): ${missed.slice(0, 8).join(", ")}${missed.length > 8 ? "…" : ""}`);
    }

    const picked = only
      ? mapped.filter((m) => {
          const hay = `${m.cinema.id} ${m.branch.Branch_Name} ${m.cinema.mall} ${m.cinema.name}`.toLowerCase();
          return hay.includes(only);
        })
      : mapped;
    if (picked.length === 0) throw new Error(`--only=${only} matched no Robinsons branch`);

    const match = await createTitleMatcher();
    for (const { branch, cinema } of picked) {
      console.log(`\n${cinema.id} — ${branch.Branch_Name} (${branch.Branch_Key})`);
      const got = await captureBranch(page, branch, cinema, days, match);
      rows.push(...got.rows);
      touched.push(...got.touched);
      unmatched.push(...got.unmatched);
    }
  } finally {
    await browser.close();
  }

  if (unmatched.length) {
    console.warn(`\nskipped ${new Set(unmatched).size} title(s) with no TMDB match:`);
    [...new Set(unmatched)].forEach((t) => console.warn(`  "${t}"`));
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
