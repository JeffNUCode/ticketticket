/**
 * Dump WTC card DOM + CCP events list for capture.
 *   node node_modules/tsx/dist/cli.mjs scripts/peek-venues-ph.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  try {
    await page.goto("https://www.wtcmanila.com.ph/calendar-activities/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const wtc = await page.evaluate(() => {
      const cards = [...document.querySelectorAll("article, .elementor-post, .type-post, .event")].slice(0, 30);
      return {
        cardCount: cards.length,
        sample: cards.slice(0, 5).map((el) => ({
          cls: el.className,
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 200),
          html: el.outerHTML.slice(0, 400),
          href: el.querySelector("a")?.href || "",
        })),
        allLinks: [...document.querySelectorAll("a[href*='calendar-of-activities']")].map((a) => ({
          href: (a as HTMLAnchorElement).href,
          text: (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
        })),
      };
    });
    console.log("WTC", JSON.stringify(wtc, null, 2).slice(0, 4000));

    // Paginate once
    const page2 = await page.request.get("https://www.wtcmanila.com.ph/calendar-activities/page/2/");
    console.log("page2", page2.status(), (await page2.text()).match(/calendar-of-activities\/[^"'/]+\//g)?.slice(0, 15));

    await page.goto("https://culturalcenter.gov.ph/events/", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(4000);
    const ccp = await page.evaluate(() => {
      const links = [...document.querySelectorAll("a[href*='/event/']")].map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
      }));
      const uniq = [...new Map(links.map((l) => [l.href, l])).values()];
      return { count: uniq.length, sample: uniq.slice(0, 15), body: document.body.innerText.slice(0, 1500) };
    });
    console.log("CCP events", JSON.stringify(ccp, null, 2).slice(0, 3500));

    // One CCP detail
    if (ccp.sample[0]?.href) {
      await page.goto(ccp.sample[0].href, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(2000);
      const detail = await page.evaluate(() => ({
        title: document.querySelector("h1")?.textContent?.trim(),
        text: document.body.innerText.slice(0, 2000),
        times: document.body.innerText.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi)?.slice(0, 5),
        clocks: document.body.innerText.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/gi)?.slice(0, 8),
      }));
      console.log("CCP detail", detail);
    }

    // SMX manila calendar section
    await page.goto("https://www.smxconventioncenter.com/smx-manila", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(3000);
    const smx = await page.evaluate(() => ({
      text: document.body.innerText.slice(0, 2500),
      events: [...document.querySelectorAll(".mec-event-article, .em-event, .mec-event-title, a")]
        .map((el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100))
        .filter((t) => /expo|show|fair|con\b|2026|2025/i.test(t))
        .slice(0, 20),
    }));
    console.log("SMX manila", smx.events, smx.text.slice(0, 800));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
