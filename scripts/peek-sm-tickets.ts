/**
 * See which SM Tickets category pages / APIs expose performing arts & attractions.
 *   node node_modules/tsx/dist/cli.mjs scripts/peek-sm-tickets.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";

const BASE = "https://smtickets.com";
const CATS = ["performingarts", "artsscience", "family", "attractions", "others", "concert", "music"];

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  try {
    await page.goto(`${BASE}/events/category/performingarts`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2000);

    // Full date feed already has everything — classify sample venues/titles
    const rows = (await page.request.get(`${BASE}/events/getEventsDate`).then((r) => r.json())) as {
      event_long_title: string;
      event_venue_name?: string;
    }[];
    console.log("total", rows.length);

    const buckets: Record<string, string[]> = { comedy: [], expo: [], other: [] };
    for (const r of rows) {
      const t = `${r.event_long_title} ${r.event_venue_name || ""}`;
      if (/comedy|theater|theatre|musical|ballet|opera|stand.?up|improv|performing|play\b/i.test(t)) {
        buckets.comedy.push(r.event_long_title);
      } else if (/expo|comic|cosplay|convention|market|workshop|fair|attraction|museum|exhibit|bazaar|carnival|festival|pickle|uaap|nba|pvl|league/i.test(t)) {
        buckets.expo.push(r.event_long_title);
      } else {
        buckets.other.push(r.event_long_title);
      }
    }
    console.log("comedy-ish", buckets.comedy.length, buckets.comedy.slice(0, 15));
    console.log("expo-ish (non-sports filter later)", buckets.expo.filter((t) => !/pickle|uaap|nba|pvl|league|cup|basket/i.test(t)).slice(0, 15));

    for (const cat of CATS) {
      const html = await page.request.get(`${BASE}/events/category/${cat}`).then((r) => r.text());
      const opts = [...html.matchAll(/event_id="(\d+)"[^>]*>([^<]+)/g)].map((m) => m[2].trim());
      console.log(`\ncategory/${cat}: ${opts.length} options sample:`, opts.slice(0, 8));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
