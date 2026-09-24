/**
 * Find Eventbrite comedy/theater listings for Manila.
 *   node node_modules/tsx/dist/cli.mjs scripts/peek-eventbrite.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";

async function dump(page: import("playwright-core").Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 }).catch(() => null);
  await page.waitForTimeout(2000);
  const cards = await page.evaluate(() => {
    const out: { href: string; title: string; loc: string }[] = [];
    for (const a of document.querySelectorAll("a[href*='/e/']")) {
      const href = (a as HTMLAnchorElement).href;
      if (!/tickets-\d+/.test(href)) continue;
      const title = (a.textContent || "").trim().replace(/\s+/g, " ");
      if (title.length < 5) continue;
      const parent = a.closest("div")?.parentElement;
      const loc =
        parent?.querySelector('[data-testid="event-card-location"], .event-card__clamp-line--location')?.textContent?.trim() ||
        "";
      out.push({ href, title: title.slice(0, 100), loc: (loc || "").slice(0, 80) });
    }
    // dedupe by href
    const seen = new Set<string>();
    return out.filter((c) => (seen.has(c.href) ? false : (seen.add(c.href), true))).slice(0, 15);
  });
  console.log("\n===", url);
  console.log(cards);
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  try {
    for (const url of [
      "https://www.eventbrite.com/d/philippines--manila/comedy--events/",
      "https://www.eventbrite.com/d/philippines--manila/theatre--events/",
      "https://www.eventbrite.com/d/philippines--manila/performing-arts--events/",
      "https://www.eventbrite.com/d/philippines--manila/food-and-drink--events/",
      "https://www.eventbrite.com/d/philippines--manila/hobbies--events/",
    ]) {
      await dump(page, url);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
