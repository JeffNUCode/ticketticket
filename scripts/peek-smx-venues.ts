/**
 *   npx tsx scripts/peek-smx-venues.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const urls = [
    "https://www.smxconventioncenter.com/smx-bacolod",
    "https://www.smxconventioncenter.com/smx-aura",
    "https://www.smxconventioncenter.com/smx-clark",
  ];
  try {
    for (const url of urls) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(3500);
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll("article.mec-event-article")].map((el) => ({
          title: el.querySelector("a.mec-color-hover")?.textContent?.trim().slice(0, 60),
          detail: el.querySelector(".mec-event-detail")?.textContent?.trim().replace(/\s+/g, " "),
        })),
      );
      console.log("\n", url, JSON.stringify(rows, null, 2));
    }

    // LD location on Negros detail
    await page.goto("https://www.smxconventioncenter.com/events/40th-negros-trade-fair-2/", {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(1000);
    const ld = await page.evaluate(() => {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          return JSON.parse(s.textContent || "");
        } catch {
          /* */
        }
      }
      return null;
    });
    console.log("\nNegros LD", JSON.stringify(ld, null, 2).slice(0, 1500));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
