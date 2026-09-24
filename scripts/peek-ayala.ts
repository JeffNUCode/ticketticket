/**
 * Observe Ayala OCAPI paths the page uses after picking a cinema / film.
 *   node node_modules/tsx/dist/cli.mjs scripts/peek-ayala.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";

const BASE = "https://www.ayalaallaccess.com";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const ocapi: { method: string; url: string; sample?: string }[] = [];

  page.on("request", (r) => {
    const u = r.url();
    if (!u.includes("digital-api.ayalaallaccess.com") && !u.includes("/ocapi/")) return;
    ocapi.push({ method: r.method(), url: u });
  });
  page.on("response", async (r) => {
    const u = r.url();
    if (!u.includes("digital-api.ayalaallaccess.com")) return;
    const hit = ocapi.find((h) => h.url === u && !h.sample);
    if (!hit) return;
    try {
      hit.sample = (await r.text()).slice(0, 800).replace(/\s+/g, " ");
    } catch {
      /* ignore */
    }
  });

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(3000);

    // Navigate to a cinema/site if the UI exposes one.
    const siteLink = page.locator("a[href*='/sites/'], a[href*='cinema'], a[href*='cinemas']").first();
    if ((await siteLink.count()) > 0) {
      const href = await siteLink.getAttribute("href");
      console.log("clicking", href);
      await siteLink.click();
      await page.waitForTimeout(5000);
    } else {
      // Try common Lumos routes.
      for (const path of ["/cinemas", "/locations", "/tickets", "/films"]) {
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    console.log("\nOCAPI calls:");
    const seen = new Set<string>();
    for (const h of ocapi) {
      const key = `${h.method} ${h.url.split("?")[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(key + (h.url.includes("?") ? "?" + h.url.split("?")[1]?.slice(0, 120) : ""));
      if (h.sample) console.log(" ", h.sample.slice(0, 400));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
