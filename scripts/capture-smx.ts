/**
 * SMX Convention Center calendars (Manila + regional) → data/events.json.
 *   npx tsx scripts/capture-smx.ts
 */
import "./env";
import { createHash } from "crypto";
import { launchBrowser, UA } from "./browser";
import { resolveOrFallback } from "../lib/event-venues";
import { mergeEventsAndWrite, parseDateRange, parseLooseTime, toPhIso } from "../lib/events-inventory";
import type { GoSeeEvent } from "@/types/events";

const SOURCE = "evt-smx-";

/** Venue landing pages that embed MEC calendars. */
const VENUE_PAGES: { url: string; venueHint: string }[] = [
  { url: "https://www.smxconventioncenter.com/smx-manila", venueHint: "SMX Manila" },
  { url: "https://www.smxconventioncenter.com/smx-aura", venueHint: "SMX Aura" },
  { url: "https://www.smxconventioncenter.com/smx-clark", venueHint: "SMX Clark" },
  { url: "https://www.smxconventioncenter.com/smx-olongapo", venueHint: "SMX Olongapo" },
  { url: "https://www.smxconventioncenter.com/smx-bacolod", venueHint: "SMX Bacolod" },
  { url: "https://www.smxconventioncenter.com/smx-davao", venueHint: "SMX Davao" },
  { url: "https://www.smxconventioncenter.com/sky-hall-seaside-cebu", venueHint: "SMX Seaside Cebu" },
];

type Listed = {
  href: string;
  title: string;
  dateText: string;
  venueText: string;
  venueHint: string;
};

function slugId(url: string) {
  const slug = url.replace(/\/$/, "").split("/").pop() || url;
  return `${SOURCE}${createHash("sha1").update(slug).digest("hex").slice(0, 12)}`;
}

function skipTitle(title: string) {
  return /worship|church|sunday service|candle lighting|bible and tract/i.test(title);
}

function isoDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return m ? m[1] : null;
}

function venueFor(row: Listed, ldLoc?: string) {
  if (ldLoc?.trim()) return resolveOrFallback(ldLoc.trim());
  const fromCard =
    /\bSMX\s+[A-Za-z]+(?:\s+[A-Za-z]+)?\b/i.exec(row.venueText)?.[0] ||
    /\bMegatrade Hall\b/i.exec(row.venueText)?.[0];
  return resolveOrFallback(fromCard || row.venueHint);
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const year = new Date().getFullYear();
  /** Prefer listing whose venueText matches the page venueHint */
  const found = new Map<string, Listed>();

  try {
    for (const site of VENUE_PAGES) {
      try {
        await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForTimeout(3500);
        const rows = (await page.evaluate((hint) => {
          return [...document.querySelectorAll("article.mec-event-article")].map((el) => {
            const a = el.querySelector("a.mec-color-hover, a[href*='/events/']") as HTMLAnchorElement | null;
            const dateEl = el.querySelector(".mec-event-date");
            const detail = el.querySelector(".mec-event-detail")?.textContent || "";
            return {
              href: (a?.href || "").split("#")[0],
              title: (a?.textContent || "").trim().replace(/\s+/g, " "),
              dateText: (dateEl?.textContent || "").trim().replace(/\s+/g, " "),
              venueText: detail.trim().replace(/\s+/g, " "),
              venueHint: hint,
            };
          });
        }, site.venueHint)) as Listed[];

        const onPage = rows.filter((r) => r.href && /\/events\/[^/]+\/?$/.test(r.href));
        console.log(`${site.venueHint}: ${onPage.length} card(s)`);

        for (const row of onPage) {
          const prev = found.get(row.href);
          if (!prev) {
            found.set(row.href, row);
            continue;
          }
          // Upgrade if this card's detail text names this venue
          const namesThis = new RegExp(site.venueHint.replace(/\s+/g, "\\s+"), "i").test(row.venueText);
          const prevNames = new RegExp(prev.venueHint.replace(/\s+/g, "\\s+"), "i").test(prev.venueText);
          if (namesThis && !prevNames) found.set(row.href, row);
        }
      } catch (e) {
        console.warn("venue page failed", site.url, e instanceof Error ? e.message : e);
      }
    }

    const byId = new Map<string, GoSeeEvent>();

    for (const row of found.values()) {
      if (skipTitle(row.title)) continue;
      try {
        await page.goto(row.href, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await page.waitForTimeout(700);
        const raw = await page.evaluate(() => {
          const h1 =
            document.querySelector("h1")?.textContent?.trim() ||
            document.querySelector(".mec-single-title")?.textContent?.trim() ||
            "";
          let ldStart = "";
          let ldEnd = "";
          let ldLoc = "";
          for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
            try {
              const j = JSON.parse(s.textContent || "");
              const ev = Array.isArray(j) ? j.find((x: { "@type"?: string }) => x["@type"] === "Event") : j;
              if (ev?.["@type"] === "Event") {
                ldStart = ev.startDate || "";
                ldEnd = ev.endDate || "";
                ldLoc = ev.location?.name || "";
              }
            } catch {
              /* ignore */
            }
          }
          const mecDate = document.querySelector(".mec-start-date-label")?.textContent?.trim() || "";
          const mecTime = document.querySelector(".mec-single-event-time")?.textContent?.trim() || "";
          const img = [...document.querySelectorAll("img")]
            .map((i) => (i as HTMLImageElement).src)
            .find((s) => /upload|event|wp-content/i.test(s) && !/logo|icon|avatar/i.test(s));
          return { h1, ldStart, ldEnd, ldLoc, mecDate, mecTime, img: img || "" };
        });

        const title = raw.h1 || row.title;
        if (!title || skipTitle(title)) continue;

        let startYmd = isoDate(raw.ldStart);
        let endYmd = isoDate(raw.ldEnd);
        let clock: string | undefined;

        if (!startYmd && (raw.mecDate || row.dateText)) {
          const range = parseDateRange((raw.mecDate || row.dateText).replace(/\s+/g, " "), year);
          if (range) {
            startYmd = range.start;
            endYmd = range.end;
          }
        }
        if (raw.mecTime) {
          const m = raw.mecTime.match(/\d{1,2}:\d{2}\s*(?:am|pm)/i);
          if (m) clock = m[0];
        } else if (raw.ldStart?.includes("T")) {
          clock = raw.ldStart.split("T")[1]?.slice(0, 5);
        }
        if (!startYmd) {
          console.warn("skip (no date)", row.href);
          continue;
        }

        const id = slugId(row.href);
        byId.set(id, {
          id,
          category: "EXPO_COMMUNITY",
          title,
          poster_url: raw.img,
          venue: venueFor(row, raw.ldLoc),
          tags: ["smx", "expo"],
          booking_url: row.href,
          updated_at: new Date().toISOString(),
          schedules: [
            {
              start_time: toPhIso(startYmd, parseLooseTime(clock)),
              end_time: endYmd ? toPhIso(endYmd, "20:00:00") : undefined,
              screen_or_hall: row.venueHint,
              ticket_status: "AVAILABLE",
            },
          ],
        });
      } catch (e) {
        console.warn("detail failed", row.href, e instanceof Error ? e.message : e);
      }
    }

    const list = [...byId.values()];
    if (list.length === 0) {
      console.warn("captured 0 SMX events (calendars may be empty)");
      return;
    }
    const total = await mergeEventsAndWrite(list, SOURCE);
    console.log(`wrote ${list.length} SMX event(s); data/events.json now ${total}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
