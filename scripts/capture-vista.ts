/**
 * Captures Vista Cinemas / Starmall showtimes from vistacinemas.com.ph.
 *
 * Flow: Branches/GetBranchesSlug → Movie/NowShowingMovies → Movie/Schedules
 *   npx tsx scripts/capture-vista.ts
 *   npx tsx scripts/capture-vista.ts --days=14
 *   npx tsx scripts/capture-vista.ts --only=evia
 */
import "./env";
import type { Page } from "playwright-core";
import { SEED } from "../lib/seed";
import type { InventoryShow } from "../lib/inventory";
import type { CinemaRow } from "../types/database";
import {
  VISTA_SITE,
  dotNetToPhIso,
  parseVistaSchedules,
  resolveVistaCinemaId,
  vistaScreenType,
  type VistaBranch,
  type VistaMovie,
} from "../lib/vista";
import { launchBrowser, UA } from "./browser";
import { createTitleMatcher } from "./match-title";
import { mergeAndWrite, type Touched } from "./inventory-io";

function arg(name: string, fallback: number) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function getJson<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (p) => {
    const res = await fetch(p, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`${p} → ${res.status}`);
    return res.json() as Promise<T>;
  }, `${VISTA_SITE}${path}`);
}

function mapBranches(branches: VistaBranch[], cinemas: CinemaRow[]) {
  const vista = cinemas.filter((c) => c.chain === "Vista Cinemas");
  const mapped: { branch: VistaBranch; cinema: CinemaRow }[] = [];
  const missed: string[] = [];
  const used = new Set<string>();
  for (const branch of branches) {
    const id = resolveVistaCinemaId(branch, vista);
    const cinema = id ? vista.find((c) => c.id === id) : undefined;
    if (cinema && !used.has(cinema.id)) {
      used.add(cinema.id);
      mapped.push({ branch, cinema });
    } else if (!cinema) {
      missed.push(`${branch.Branch_Name} (${branch.Branch_Key})`);
    }
  }
  return { mapped, missed };
}

async function captureBranch(
  page: Page,
  branch: VistaBranch,
  cinema: CinemaRow,
  movies: VistaMovie[],
  days: number,
  match: (title: string) => Promise<string | null>,
) {
  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched = new Set<string>();
  const book = cinema.website_booking_url;

  for (const movie of movies) {
    const title = movie.MovieName?.trim();
    if (!title) continue;

    let raw: unknown;
    try {
      raw = await getJson(
        page,
        `/Movie/Schedules?branchKey=${branch.Branch_Key}&movieName=${encodeURIComponent(title)}`,
      );
    } catch {
      continue;
    }

    const slots = parseVistaSchedules(raw, days);
    if (slots.length === 0) continue;

    const movieId = await match(title);
    if (!movieId) {
      unmatched.add(title);
      continue;
    }

    for (const slot of slots) {
      const start = dotNetToPhIso(slot.start);
      if (!start) continue;
      const day = start.slice(0, 10);
      touched.push({ cinemaId: cinema.id, date: day });
      rows.push({
        movie_id: movieId,
        title,
        cinema_id: cinema.id,
        screen_type: vistaScreenType(slot.filmFormat),
        start_time: start,
        price: slot.price,
        booking_direct_url: book,
      });
    }
    console.log(`    ${title}: ${slots.length} showtime(s)`);
  }

  return { rows, touched, unmatched: [...unmatched] };
}

async function main() {
  const days = arg("days", 14);
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1]?.toLowerCase();

  const cinemas = SEED.cinemas.filter((c) => c.chain === "Vista Cinemas");
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });

  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched: string[] = [];

  try {
    await page.goto(VISTA_SITE, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const branches = await getJson<VistaBranch[]>(page, "/Branches/GetBranchesSlug");
    const moviePayload = await getJson<{ NowShowingMovies: VistaMovie[] }>(page, "/Movie/NowShowingMovies/");
    const movies = moviePayload.NowShowingMovies ?? [];
    console.log(`${branches.length} branch(es), ${movies.length} now-showing title(s)`);

    const { mapped, missed } = mapBranches(branches, cinemas);
    if (missed.length) {
      console.warn(`unmapped branches (${missed.length}): ${missed.join(", ")}`);
    }

    const picked = only
      ? mapped.filter((m) => {
          const hay = `${m.cinema.id} ${m.branch.Branch_Name} ${m.cinema.mall} ${m.cinema.name}`.toLowerCase();
          return hay.includes(only);
        })
      : mapped;
    if (picked.length === 0) throw new Error(`--only=${only} matched no Vista branch`);

    const match = await createTitleMatcher();
    for (const { branch, cinema } of picked) {
      console.log(`\n${cinema.id} — ${branch.Branch_Name} (${branch.Branch_Key})`);
      const got = await captureBranch(page, branch, cinema, movies, days, match);
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
