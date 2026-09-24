/**
 * Captures Ayala Malls showtimes via Ayala All Access (Vista OCAPI).
 * Same pattern as capture-sm.ts — page mints a short-lived token; we query by site id.
 *
 *   npx tsx scripts/capture-ayala.ts
 *   npx tsx scripts/capture-ayala.ts --days=7
 *   npx tsx scripts/capture-ayala.ts --only=c-ayala-gc
 */
import "./env";
import { randomUUID } from "crypto";
import { type APIRequestContext, type Page } from "playwright-core";
import { launchBrowser, UA } from "./browser";
import { SEED } from "../lib/seed";
import type { InventoryShow } from "../lib/inventory";
import { AYALA_API, AYALA_BOOT, AYALA_SITE_IDS, ayalaSiteIdOf } from "../lib/ayala";
import { createTitleMatcher } from "./match-title";
import { mergeAndWrite, type Touched } from "./inventory-io";
import type { CinemaRow, ScreenType } from "../types/database";

type Named = { text: string };
type OcapiShowtime = {
  id: string;
  schedule: { businessDate: string; startsAt: string };
  filmId: string;
  screenId: string;
  requires3dGlasses: boolean;
};
type ShowtimesResponse = {
  showtimes?: OcapiShowtime[];
  relatedData?: {
    films?: { id: string; title: Named }[];
    screens?: { id: string; name: Named }[];
  };
};
type DatesResponse = { filmScreeningDates?: { businessDate: string }[] };

function arg(name: string, fallback: number) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function siteIdOf(cinema: CinemaRow) {
  const fromUrl = ayalaSiteIdOf(cinema.website_booking_url);
  if (fromUrl) return fromUrl;
  const fromMap = Object.entries(AYALA_SITE_IDS).find(([, id]) => id === cinema.id)?.[0];
  if (fromMap) return fromMap;
  throw new Error(`${cinema.id}: no Ayala site id`);
}

function screenType(show: OcapiShowtime, screenName: string): ScreenType {
  if (/imax/i.test(screenName)) return "IMAX";
  if (/director|a-luxe|aluxe|premier/i.test(screenName)) return "Director's Club";
  if (/4dx/i.test(screenName)) return "Director's Club"; // closest bucket we have
  return show.requires3dGlasses ? "3D" : "2D";
}

async function authorize(page: Page) {
  const seen = page.waitForRequest((r) => r.url().includes("/ocapi/"), { timeout: 90_000 });
  await page.goto(AYALA_BOOT, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const auth = (await seen).headers()["authorization"];
  if (!auth) throw new Error("page made no authorised OCAPI call — layout changed?");
  return auth;
}

async function getJson<T>(api: APIRequestContext, path: string, auth: string): Promise<T> {
  const res = await api.get(`${AYALA_API}${path}`, {
    headers: { authorization: auth, accept: "application/json", correlationid: randomUUID() },
  });
  if (!res.ok()) throw new Error(`OCAPI ${res.status()} ${path}`);
  return res.json() as Promise<T>;
}

async function captureCinema(
  api: APIRequestContext,
  auth: string,
  cinema: CinemaRow,
  days: number,
  match: (title: string) => Promise<string | null>,
) {
  const siteId = siteIdOf(cinema);
  const dates = await getJson<DatesResponse>(api, `/film-screening-dates?siteIds=${siteId}`, auth);
  const wanted = (dates.filmScreeningDates ?? []).map((d) => d.businessDate).slice(0, days);

  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched = new Set<string>();

  for (const date of wanted) {
    const body = await getJson<ShowtimesResponse>(
      api,
      `/showtimes/by-business-date/${date}?siteIds=${siteId}`,
      auth,
    );
    const films = new Map((body.relatedData?.films ?? []).map((f) => [f.id, f.title.text]));
    const screens = new Map((body.relatedData?.screens ?? []).map((s) => [s.id, s.name.text]));
    touched.push({ cinemaId: cinema.id, date });

    for (const show of body.showtimes ?? []) {
      const title = films.get(show.filmId);
      if (!title) continue;
      const movieId = await match(title);
      if (!movieId) {
        unmatched.add(title);
        continue;
      }
      rows.push({
        movie_id: movieId,
        title,
        cinema_id: cinema.id,
        screen_type: screenType(show, screens.get(show.screenId) ?? ""),
        start_time: show.schedule.startsAt,
        price: null,
        booking_direct_url: cinema.website_booking_url,
      });
    }
    console.log(`  ${date}: ${body.showtimes?.length ?? 0} showtime(s)`);
  }

  return { rows, touched, unmatched: [...unmatched] };
}

async function main() {
  const sites = SEED.cinemas.filter((c) => c.chain === "Ayala Malls");
  if (sites.length === 0) throw new Error("no Ayala cinemas in catalog");

  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  const picked = only
    ? sites.filter((c) => {
        try {
          return c.id === only || c.id.endsWith(only) || siteIdOf(c) === only || c.mall.toLowerCase().includes(only.toLowerCase());
        } catch {
          return c.id.includes(only) || c.mall.toLowerCase().includes(only.toLowerCase());
        }
      })
    : sites.filter((c) => {
        try {
          siteIdOf(c);
          return true;
        } catch {
          return false;
        }
      });
  if (picked.length === 0) throw new Error(`--only=${only} matched no Ayala cinema with a site id`);

  const days = arg("days", 7);
  const match = await createTitleMatcher();

  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });

  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched: string[] = [];

  try {
    const auth = await authorize(page);
    const api = page.request;
    for (const cinema of picked) {
      console.log(`\n${cinema.id} — ${cinema.mall} (${siteIdOf(cinema)})`);
      const got = await captureCinema(api, auth, cinema, days, match);
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
