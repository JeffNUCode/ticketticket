/**
 *   npx tsx scripts/peek-smx-detail.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  try {
    await page.goto("https://www.smxconventioncenter.com/smx-manila", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForTimeout(4000);
    const list = await page.evaluate(() => {
      const articles = [...document.querySelectorAll(".mec-event-article, .mec-skin-list-events-container article, article")];
      return articles.slice(0, 8).map((el) => ({
        cls: String(el.className).slice(0, 100),
        html: el.outerHTML.slice(0, 800),
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 250),
        href: el.querySelector("a[href*='/events/']")?.getAttribute("href") || "",
        start: el.querySelector("[class*=start], time, .mec-start-date-label, .mec-event-date")?.textContent?.trim(),
        dateAttrs: [...el.querySelectorAll("[datetime], [data-event-id], [class*=date]")].map((n) => ({
          tag: n.tagName,
          cls: String((n as HTMLElement).className).slice(0, 80),
          dt: n.getAttribute("datetime"),
          text: (n.textContent || "").trim().slice(0, 80),
        })),
      }));
    });
    console.log("LIST", JSON.stringify(list, null, 2).slice(0, 8000));

    await page.goto(
      "https://www.smxconventioncenter.com/events/47th-wedding-expo-philippines/",
      { waitUntil: "domcontentloaded", timeout: 60_000 },
    );
    await page.waitForTimeout(2500);
    const detail = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) =>
        (s.textContent || "").slice(0, 500),
      );
      const mec = [...document.querySelectorAll("[class*=mec-]")]
        .filter((el) => /date|start|end|time|title/i.test(el.className))
        .slice(0, 20)
        .map((el) => ({
          cls: String(el.className).slice(0, 100),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
        }));
      return {
        title: document.title,
        h1: document.querySelector("h1")?.textContent?.trim(),
        ld,
        mec,
        dateHits: html.match(/\d{4}-\d{2}-\d{2}/g)?.slice(0, 20),
        bodySlice: document.body.innerText.slice(0, 1500),
      };
    });
    console.log("DETAIL", JSON.stringify(detail, null, 2).slice(0, 8000));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
