/**
 * World Trade Center Metro Manila calendar → data/events.json (expos).
 *   npx tsx scripts/capture-wtc.ts
 */
import "./env";
import { createHash } from "crypto";
import { launchBrowser, UA } from "./browser";
import { resolveOrFallback } from "../lib/event-venues";
import { mergeEventsAndWrite, parseDateRange, parseLooseTime, toPhIso } from "../lib/events-inventory";
import type { GoSeeEvent } from "@/types/events";

const SOURCE = "evt-wtc-";
const LIST = "https://www.wtcmanila.com.ph/calendar-activities/";
const VENUE = resolveOrFallback("World Trade Center Metro Manila");

function slugId(url: string) {
  const slug = url.replace(/\/$/, "").split("/").pop() || url;
  return `${SOURCE}${createHash("sha1").update(slug).digest("hex").slice(0, 12)}`;
}

function titleFromSlug(url: string) {
  const slug = url.replace(/\/$/, "").split("/").pop() || "";
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const byId = new Map<string, GoSeeEvent>();

  try {
    const urls = new Set<string>();
    for (let p = 1; p <= 3; p++) {
      const url = p === 1 ? LIST : `${LIST}page/${p}/`;
      const res = await page.request.get(url);
      if (!res.ok()) break;
      const html = await res.text();
      for (const m of html.match(/https:\/\/www\.wtcmanila\.com\.ph\/calendar-of-activities\/[^"'/]+\//g) || []) {
        urls.add(m);
      }
    }
    console.log(`${urls.size} WTC listing(s)`);

    for (const url of urls) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(800);
        const raw = await page.evaluate(() => {
          const body = document.body.innerText;
          const h1 =
            document.querySelector("h1")?.textContent?.trim() ||
            document.querySelector(".elementor-heading-title")?.textContent?.trim() ||
            "";
          const dateLine =
            body.match(
              /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s+\d{4}\b/i,
            )?.[0] || "";
          const clock = body.match(/\b\d{1,2}:\d{2}\s*(?:am|pm)\b/i)?.[0];
          const img = [...document.querySelectorAll("img")]
            .map((i) => (i as HTMLImageElement).src)
            .find((s) => /wp-content\/uploads/i.test(s) && !/logo|icon|avatar|elementor/i.test(s));
          return { h1, dateLine, clock, img: img || "", titleAttr: document.title };
        });

        const range = raw.dateLine ? parseDateRange(raw.dateLine) : null;
        if (!range) {
          console.warn("skip (no date)", url);
          continue;
        }

        const title =
          (raw.h1 && !/^calendar/i.test(raw.h1) ? raw.h1 : "") ||
          titleFromSlug(url) ||
          raw.titleAttr.split("|")[0].trim();
        if (!title) continue;

        const start = toPhIso(range.start, parseLooseTime(raw.clock));
        const end = range.end ? toPhIso(range.end, "18:00:00") : undefined;
        const id = slugId(url);

        byId.set(id, {
          id,
          category: "EXPO_COMMUNITY",
          title,
          poster_url: raw.img,
          venue: VENUE,
          tags: ["wtc", "expo"],
          booking_url: url,
          updated_at: new Date().toISOString(),
          schedules: [{ start_time: start, end_time: end, ticket_status: "AVAILABLE" }],
        });
      } catch (e) {
        console.warn("detail failed", url, e instanceof Error ? e.message : e);
      }
    }
  } finally {
    await browser.close();
  }

  const list = [...byId.values()];
  if (list.length === 0) throw new Error("captured 0 WTC events");
  const total = await mergeEventsAndWrite(list, SOURCE);
  console.log(`wrote ${list.length} WTC event(s); data/events.json now ${total}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
