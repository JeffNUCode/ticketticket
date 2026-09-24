/**
 * Captures Megaworld showtimes from tickets.megaworldcinemas.com (HelixPay).
 *
 * Schedule is embedded in SSR HTML: category page lists film×screen products,
 * each product page carries date + timeslot option values. No OCAPI like SM.
 *
 *   npx tsx scripts/capture-megaworld.ts
 *   npx tsx scripts/capture-megaworld.ts --days=14
 *   npx tsx scripts/capture-megaworld.ts --only=eastwood
 */
import "./env";
import { SEED } from "../lib/seed";
import type { InventoryShow } from "../lib/inventory";
import {
  MEGA_GROUP,
  fetchMegaGroups,
  filterMegaDates,
  megaCategoryUrl,
  megaProductUrl,
  parseMegaCategory,
  parseMegaProduct,
  megaStartIso,
} from "../lib/mega";
import { createTitleMatcher } from "./match-title";
import { mergeAndWrite, type Touched } from "./inventory-io";

const UA = "Mozilla/5.0 (compatible; ticketticket/1.0)";

function arg(name: string, fallback: number) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function fetchHtml(url: string) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

async function captureMall(
  groupSlug: string,
  days: number,
  match: (title: string) => Promise<string | null>,
) {
  const cinemaId = MEGA_GROUP[groupSlug];
  const cinema = SEED.cinemas.find((c) => c.id === cinemaId);
  if (!cinema) throw new Error(`no cinema for group ${groupSlug}`);

  const products = parseMegaCategory(await fetchHtml(megaCategoryUrl(groupSlug)), groupSlug);

  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched = new Set<string>();

  console.log(`  ${products.length} film product(s)`);

  for (const card of products) {
    const detail = parseMegaProduct(
      await fetchHtml(megaProductUrl(groupSlug, card.slug)),
      card.slug,
    );
    const title = detail.title || card.title;
    const screen = detail.screen || card.screen;
    const dates = filterMegaDates(detail.dates, days);
    if (dates.length === 0 || detail.times.length === 0) continue;

    const movieId = await match(title);
    if (!movieId) {
      unmatched.add(title);
      continue;
    }

    const book = megaProductUrl(groupSlug, card.slug);
    for (const date of dates) {
      touched.push({ cinemaId: cinema.id, date });
      for (const time of detail.times) {
        rows.push({
          movie_id: movieId,
          title,
          cinema_id: cinema.id,
          screen_type: screen,
          start_time: megaStartIso(date, time),
          price: card.price,
          booking_direct_url: book,
        });
      }
    }
    console.log(`    ${title} (${card.slug}): ${dates.length}×${detail.times.length}`);
  }

  return { rows, touched, unmatched: [...unmatched] };
}

async function main() {
  const days = arg("days", 7);
  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  const groups = (await fetchMegaGroups()).filter((g) => MEGA_GROUP[g.slug]);
  const picked = only ? groups.filter((g) => g.slug === only || g.slug.includes(only)) : groups;
  if (picked.length === 0) throw new Error(`--only=${only} matched no Megaworld mall`);

  const match = await createTitleMatcher();
  const rows: InventoryShow[] = [];
  const touched: Touched[] = [];
  const unmatched: string[] = [];

  for (const group of picked) {
    console.log(`\n${MEGA_GROUP[group.slug]} — ${group.name} (${group.slug})`);
    const got = await captureMall(group.slug, days, match);
    rows.push(...got.rows);
    touched.push(...got.touched);
    unmatched.push(...got.unmatched);
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
