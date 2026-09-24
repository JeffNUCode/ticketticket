/**
 * Deeper WTC / SMX / CCP structure for capture scripts.
 *   npx tsx scripts/peek-venues-detail.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  try {
    await page.goto("https://www.wtcmanila.com.ph/calendar-of-activities/manila-fame-2026/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(2000);
    const wtc = await page.evaluate(() => {
      const h1 = document.querySelector("h1")?.textContent?.trim();
      const body = document.body.innerText;
      const dates = body.match(
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s+\d{4}\b/gi,
      );
      const imgs = [...document.querySelectorAll("img")]
        .map((i) => (i as HTMLImageElement).src)
        .filter((s) => s && !/logo|icon|avatar|elementor|gravatar/i.test(s))
        .slice(0, 5);
      return { h1, dates: dates?.slice(0, 8), excerpt: body.slice(0, 1400), imgs };
    });
    console.log("WTC DETAIL", JSON.stringify(wtc, null, 2));

    const all = new Set<string>();
    for (let p = 1; p <= 5; p++) {
      const url =
        p === 1
          ? "https://www.wtcmanila.com.ph/calendar-activities/"
          : `https://www.wtcmanila.com.ph/calendar-activities/page/${p}/`;
      const res = await page.request.get(url);
      if (!res.ok()) {
        console.log("wtc page", p, res.status());
        break;
      }
      const html = await res.text();
      const matches = html.match(/https:\/\/www\.wtcmanila\.com\.ph\/calendar-of-activities\/[^"'/]+\//g) || [];
      for (const m of matches) all.add(m);
      console.log("wtc page", p, "links", matches.length);
    }
    console.log("wtc unique", [...all]);

    await page.goto("https://www.smxconventioncenter.com/smx-manila", {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(5000);
    const smx = await page.evaluate(() => {
      const links = [...document.querySelectorAll("a")]
        .map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
        }))
        .filter((l) => /event|expo|detail|calendar/i.test(l.href + " " + l.text) && l.href.startsWith("http"))
        .slice(0, 50);
      const mec = [...document.querySelectorAll("[class*=mec-]")]
        .slice(0, 25)
        .map((el) => ({
          cls: String(el.className).slice(0, 100),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160),
          href: el.querySelector("a")?.getAttribute("href") || "",
        }));
      // Parse listing blocks that look like "24 - 25 Sep Title"
      const lines = document.body.innerText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^\d{1,2}\s*[-–]\s*\d{1,2}\s+[A-Za-z]{3}\b/.test(l) || /EVENT DETAIL/i.test(l));
      return { links, mecCount: mec.length, mec: mec.slice(0, 15), lines: lines.slice(0, 30), title: document.title };
    });
    console.log("SMX", JSON.stringify(smx, null, 2).slice(0, 6000));

    // CCP list-view may expose dates better
    await page.goto("https://culturalcenter.gov.ph/events/list/?tribe_eventcategory%5B0%5D=&eventDisplay=list", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(4000);
    const ccpList = await page.evaluate(() => {
      const articles = [...document.querySelectorAll("article, .tribe-events-calendar-list__event, .type-tribe_events")].slice(
        0,
        12,
      );
      return {
        count: articles.length,
        sample: articles.slice(0, 6).map((el) => ({
          cls: String(el.className).slice(0, 120),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 250),
          href: el.querySelector("a")?.getAttribute("href") || "",
          time: el.querySelector("time")?.getAttribute("datetime") || el.querySelector("time")?.textContent || "",
        })),
      };
    });
    console.log("CCP list", JSON.stringify(ccpList, null, 2).slice(0, 4000));

    // CCP music event with clock
    await page.goto(
      "https://culturalcenter.gov.ph/event/philippine-philharmonic-orchestra-modulatio-the-ppos-42nd-concert-season-concert-i-da-capo/",
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    await page.waitForTimeout(2000);
    const ccpMusic = await page.evaluate(() => {
      const h1 = document.querySelector("h1")?.textContent?.trim();
      const times = [...document.querySelectorAll("time")].map((t) => ({
        datetime: t.getAttribute("datetime"),
        text: (t.textContent || "").trim(),
      }));
      const cats = [...document.querySelectorAll("a[href*='/events/category/']")].map((a) =>
        (a.textContent || "").trim(),
      );
      const venue = [...document.querySelectorAll(".tribe-events-venue, .tribe-venue, [class*=venue]")]
        .map((el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120))
        .slice(0, 5);
      const body = document.body.innerText.slice(0, 900);
      return { h1, times, cats, venue, body };
    });
    console.log("CCP music", JSON.stringify(ccpMusic, null, 2).slice(0, 3500));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
