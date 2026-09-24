/**
 * Cultural Center of the Philippines events calendar → data/events.json.
 *   npx tsx scripts/capture-ccp.ts
 */
import "./env";
import { createHash } from "crypto";
import { launchBrowser, UA } from "./browser";
import { resolveOrFallback } from "../lib/event-venues";
import { mergeEventsAndWrite, parseLooseDate, parseLooseTime, toPhIso } from "../lib/events-inventory";
import type { EventCategory, GoSeeEvent } from "@/types/events";

const SOURCE = "evt-ccp-";
const LIST = "https://culturalcenter.gov.ph/events/list/?eventDisplay=list";

type Row = {
  href: string;
  title: string;
  startDate: string;
  endDate: string;
  startClock: string;
  endClock: string;
  venue: string;
  cats: string;
  text: string;
};

function categoryOf(title: string, cats: string): EventCategory {
  const blob = `${title} ${cats}`.toLowerCase();
  if (/theater|theatre|dance|ballet|opera|film|visual arts|literary|comedy|play\b/.test(blob)) {
    return "COMEDY_THEATER";
  }
  if (/music|orchestra|concert|philharmonic|outreach/.test(blob)) return "CONCERT";
  if (/festival|market|conference|fair|expo/.test(blob)) return "EXPO_COMMUNITY";
  return "COMEDY_THEATER";
}

function slugId(url: string) {
  const slug = url.replace(/\/$/, "").split("/").pop() || url;
  return `${SOURCE}${createHash("sha1").update(slug).digest("hex").slice(0, 12)}`;
}

function keep(row: Row) {
  if (!row.href || !row.title || !row.startDate) return false;
  // Placeholder / evergreen handbook entries
  if (/safe space handbook/i.test(row.title)) return false;
  if (+row.startDate.slice(0, 4) >= 2030) return false;
  return true;
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const byId = new Map<string, GoSeeEvent>();

  try {
    await page.goto(LIST, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(4000);

    // Tribe Events list — paginate via "Next" a few times
    for (let pageNum = 0; pageNum < 6; pageNum++) {
      const rows = await page.evaluate(() => {
        const articles = [
          ...document.querySelectorAll(
            "article.tribe-events-calendar-list__event, .tribe-events-calendar-list__event",
          ),
        ];
        return articles.map((el) => {
          const link =
            (el.querySelector("a.tribe-events-calendar-list__event-title-link") as HTMLAnchorElement) ||
            (el.querySelector("a[href*='/event/']") as HTMLAnchorElement);
          const title =
            link?.textContent?.trim() ||
            el.querySelector(".tribe-events-calendar-list__event-title")?.textContent?.trim() ||
            "";
          const times = [...el.querySelectorAll("time")];
          const startDate = times[0]?.getAttribute("datetime")?.slice(0, 10) || times[0]?.textContent?.trim() || "";
          const endDate = times[1]?.getAttribute("datetime")?.slice(0, 10) || "";
          const text = (el.textContent || "").trim().replace(/\s+/g, " ");
          const clocks = text.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi) || [];
          const venue =
            el.querySelector(".tribe-events-calendar-list__event-venue-title")?.textContent?.trim() ||
            el.querySelector("[class*=venue]")?.textContent?.trim() ||
            "";
          const cats = [...el.querySelectorAll("a[href*='/events/category/']")]
            .map((a) => (a.textContent || "").trim())
            .join(" ");
          return {
            href: link?.href || "",
            title,
            startDate,
            endDate,
            startClock: clocks[0] || "",
            endClock: clocks[1] || "",
            venue,
            cats,
            text: text.slice(0, 400),
          };
        });
      });

      console.log(`CCP list page ${pageNum + 1}: ${rows.length} row(s)`);
      for (const row of rows as Row[]) {
        if (!keep(row)) continue;
        // Normalize date if tribe only gave "September 18"
        let startYmd = /^\d{4}-\d{2}-\d{2}$/.test(row.startDate) ? row.startDate : null;
        if (!startYmd) {
          const m = row.text.match(
            /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i,
          );
          if (m) startYmd = parseLooseDate(m[0]);
        }
        if (!startYmd) continue;

        const endYmd = /^\d{4}-\d{2}-\d{2}$/.test(row.endDate) ? row.endDate : undefined;
        const category = categoryOf(row.title, row.cats);
        const venue = resolveOrFallback(row.venue || "Cultural Center of the Philippines");
        const id = slugId(row.href);

        byId.set(id, {
          id,
          category,
          title: row.title,
          poster_url: "",
          venue,
          tags: ["ccp", category.toLowerCase(), ...(row.cats ? [row.cats.toLowerCase().split(/\s+/)[0]] : [])],
          booking_url: row.href,
          updated_at: new Date().toISOString(),
          schedules: [
            {
              start_time: toPhIso(startYmd, parseLooseTime(row.startClock, "19:00:00")),
              end_time: endYmd
                ? toPhIso(endYmd, parseLooseTime(row.endClock, "21:00:00"))
                : undefined,
              screen_or_hall: row.venue || undefined,
              ticket_status: "AVAILABLE",
            },
          ],
        });
      }

      const next = page.locator("a.tribe-events-c-nav__next, a[rel='next']").first();
      if ((await next.count()) === 0) break;
      const disabled = await next.getAttribute("aria-disabled");
      if (disabled === "true") break;
      try {
        await next.click({ timeout: 5_000 });
        await page.waitForTimeout(2500);
      } catch {
        break;
      }
    }

    // Month view catches short-run / all-day events list view sometimes omits
    await page.goto("https://culturalcenter.gov.ph/events/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(3000);
    const monthLinks = await page.evaluate(() => {
      const links = [...document.querySelectorAll("a[href*='/event/']")].map((a) => ({
        href: (a as HTMLAnchorElement).href,
        title: (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160),
      }));
      return [...new Map(links.map((l) => [l.href, l])).values()];
    });
    console.log(`CCP month extras: ${monthLinks.length} link(s)`);

    for (const link of monthLinks) {
      const id = slugId(link.href);
      if (byId.has(id)) continue;
      try {
        await page.goto(link.href, { waitUntil: "domcontentloaded", timeout: 45_000 });
        await page.waitForTimeout(600);
        const detail = await page.evaluate(() => {
          const body = document.body.innerText;
          const title = document.querySelector("h1")?.textContent?.trim() || "";
          const dateLine =
            body.match(
              /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i,
            )?.[0] || "";
          const clock = body.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i)?.[0] || "";
          const venue =
            [...document.querySelectorAll("[class*=venue]")]
              .map((el) => (el.textContent || "").trim().replace(/\s+/g, " "))
              .find((t) => t.length > 3 && t.length < 120) || "";
          const cats = [...document.querySelectorAll("a[href*='/events/category/']")]
            .map((a) => (a.textContent || "").trim())
            .filter((t) => t && t.length < 40)
            .slice(0, 3)
            .join(" ");
          return { title, dateLine, clock, venue, cats };
        });
        const startYmd = detail.dateLine ? parseLooseDate(detail.dateLine) : null;
        if (!startYmd || !detail.title) continue;
        if (/safe space handbook/i.test(detail.title) || +startYmd.slice(0, 4) >= 2030) continue;

        const category = categoryOf(detail.title, detail.cats);
        byId.set(id, {
          id,
          category,
          title: detail.title,
          poster_url: "",
          venue: resolveOrFallback(detail.venue || "Cultural Center of the Philippines"),
          tags: ["ccp", category.toLowerCase()],
          booking_url: link.href,
          updated_at: new Date().toISOString(),
          schedules: [
            {
              start_time: toPhIso(startYmd, parseLooseTime(detail.clock, "19:00:00")),
              screen_or_hall: detail.venue || undefined,
              ticket_status: "AVAILABLE",
            },
          ],
        });
      } catch (e) {
        console.warn("ccp detail failed", link.href, e instanceof Error ? e.message : e);
      }
    }
  } finally {
    await browser.close();
  }

  const list = [...byId.values()];
  if (list.length === 0) throw new Error("captured 0 CCP events");
  const total = await mergeEventsAndWrite(list, SOURCE);
  console.log(`wrote ${list.length} CCP event(s); data/events.json now ${total}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
