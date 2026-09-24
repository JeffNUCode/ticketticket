/**
 * Captures SM Cinema showtimes by driving a real browser.
 *
 * smcinema.com is a Lumos (Vista) SPA behind Cloudflare: the times are never in the HTML,
 * they come from Vista OCAPI at digital-api.smcinema.com, which the page authorises with a
 * short-lived token it mints per load. So we let the page authenticate itself, borrow the
 * header for the duration of the run, and read the same JSON the site reads.
 *
 * The token stays in memory — it is never logged or written to disk, and it expires anyway.
 * Targets come from SEED.cinemas: any cinema whose booking URL is an SM site page.
 *
 *   npx tsx scripts/capture-sm.ts               # SM's published window (up to 30 dates)
 *   npx tsx scripts/capture-sm.ts --days=7     # shorter window
 *   npx tsx scripts/capture-sm.ts --inspect     # list JSON endpoints, write nothing
 */
import "./env";
import { randomUUID } from "crypto";
import { type APIRequestContext, type Page } from "playwright-core";
import { launchBrowser, UA } from "./browser";
import { SEED } from "../lib/seed";
import type { InventoryShow } from "../lib/inventory";
import { createTitleMatcher } from "./match-title";
import { mergeAndWrite, type Touched } from "./inventory-io";
import type { CinemaRow, ScreenType } from "../types/database";

const API = "https://digital-api.smcinema.com/ocapi/v1";
const SM_SITE = /smcinema\.com\/sites\//;
/** Known-good page used only to mint the OCAPI token. Capture then queries every site by id. */
const BOOT = "https://www.smcinema.com/sites/SM-City-Dasmarinas/2402";

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
  const id = new URL(cinema.website_booking_url).pathname.split("/").filter(Boolean).pop();
  if (!id || !/^\d+$/.test(id)) {
    throw new Error(`${cinema.id}: no SM site id in ${cinema.website_booking_url}`);
  }
  return id;
}

/**
 * ponytail: screen type is inferred from the screen's name plus the 3D-glasses flag, because
 * OCAPI reports format as opaque attributeIds ("0000000001") with no public lookup. Upgrade
 * path: fetch the attribute list once and map ids to names.
 */
function screenType(show: OcapiShowtime, screenName: string): ScreenType {
  if (/imax/i.test(screenName)) return "IMAX";
  if (/director/i.test(screenName)) return "Director's Club";
  return show.requires3dGlasses ? "3D" : "2D";
}

/** Opens the site page and returns an API context carrying the page's own auth header. */
async function authorize(page: Page, url: string) {
  const seen = page.waitForRequest((r) => r.url().includes("/ocapi/"), { timeout: 90_000 });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const auth = (await seen).headers()["authorization"];
  if (!auth) throw new Error("page made no authorised OCAPI call — layout changed?");
  return auth;
}

async function getJson<T>(api: APIRequestContext, path: string, auth: string): Promise<T> {
  const res = await api.get(`${API}${path}`, {
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

  const dates = await getJson<DatesResponse>(
    api,
    `/film-screening-dates?siteIds=${siteId}`,
    auth,
  );
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
        // OCAPI already returns local time with offset, so no timezone conversion here.
        start_time: show.schedule.startsAt,
        price: null,
        booking_direct_url: cinema.website_booking_url,
      });
    }
    console.log(`  ${date}: ${body.showtimes?.length ?? 0} showtime(s)`);
  }

  return { rows, touched, unmatched: [...unmatched] };
}

async function inspect(page: Page, cinema: CinemaRow) {
  const urls = new Set<string>();
  page.on("response", (r) => {
    if ((r.headers()["content-type"] ?? "").includes("json")) urls.add(new URL(r.url()).pathname);
  });
  await page.goto(cinema.website_booking_url, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(3000);
  [...urls].sort().forEach((u) => console.log(`  ${u}`));
}

async function main() {
  const sites = SEED.cinemas.filter((c) => c.chain === "SM Cinema" && SM_SITE.test(c.website_booking_url));
  if (sites.length === 0) throw new Error("no SM site URLs in catalog");

  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  const picked = only ? sites.filter((c) => c.id === only || c.id.endsWith(only) || siteIdOf(c) === only) : sites;
  if (picked.length === 0) throw new Error(`--only=${only} matched no SM cinema`);

  const inspecting = process.argv.includes("--inspect");
  const days = arg("days", 7);
  const match = inspecting ? async () => null : await createTitleMatcher();

  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });

  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched: string[] = [];

  try {
    if (inspecting) {
      await inspect(page, picked[0]);
      return;
    }
    const auth = await authorize(page, BOOT);
    const api = page.request;
    for (const cinema of picked) {
      console.log(`\n${cinema.id} — ${cinema.mall}`);
      const got = await captureCinema(api, auth, cinema, days, match);
      rows.push(...got.rows);
      touched.push(...got.touched);
      unmatched.push(...got.unmatched);
    }
  } finally {
    await browser.close();
  }

  if (inspecting) return;

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
