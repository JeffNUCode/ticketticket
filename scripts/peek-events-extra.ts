/**
 * Probe TicketWorld + Eventbrite PH for comedy/theater/expo listings.
 *   node node_modules/tsx/dist/cli.mjs scripts/peek-events-extra.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });

  try {
    console.log("\n======== TICKETWORLD ========");
    const twHits: { m: string; u: string; s?: string }[] = [];
    page.on("request", (r) => {
      const u = r.url();
      if (!/ticketworld|api|event|show/i.test(u)) return;
      if (/\.(png|jpg|css|woff|ico|svg)(\?|$)/i.test(u)) return;
      twHits.push({ m: r.method(), u });
    });
    page.on("response", async (r) => {
      const hit = twHits.find((h) => h.u === r.url() && !h.s);
      if (!hit) return;
      try {
        const t = await r.text();
        if (t.trim().startsWith("{") || t.trim().startsWith("[")) hit.s = t.slice(0, 700);
      } catch {
        /* ignore */
      }
    });

    for (const url of [
      "https://ticketworld.com.ph",
      "https://www.ticketworld.com.ph",
      "https://ticketworld.com.ph/events",
      "https://ticketworldph.com",
    ]) {
      try {
        const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
        console.log(url, "→", page.url(), res?.status(), await page.title());
        await page.waitForTimeout(3000);
        const text = await page.evaluate(() => document.body.innerText.slice(0, 1200));
        console.log(text.replace(/\s+/g, " ").slice(0, 600));
        const links = await page.$$eval("a[href]", (as) =>
          [...new Set(as.map((a) => (a as HTMLAnchorElement).href))]
            .filter((h) => /event|show|concert|theater|comedy|musical/i.test(h))
            .slice(0, 20),
        );
        console.log("links:", links.join("\n  "));
        if (page.url().includes("ticketworld") && !page.url().includes("chrome-error")) break;
      } catch (e) {
        console.log(url, e instanceof Error ? e.message : e);
      }
    }
    console.log("tw json:");
    for (const h of twHits.filter((x) => x.s).slice(0, 15)) {
      console.log(h.m, h.u.slice(0, 120));
      console.log(" ", h.s?.slice(0, 400));
    }

    console.log("\n======== EVENTBRITE ========");
    // Public search SSR / API
    const ebUrl =
      "https://www.eventbrite.com/d/philippines--manila/events/?page=1&lang=en";
    const ebHits: { m: string; u: string; s?: string }[] = [];
    page.removeAllListeners("request");
    page.removeAllListeners("response");
    page.on("request", (r) => {
      const u = r.url();
      if (!/eventbrite/i.test(u)) return;
      if (/\.(png|jpg|css|woff|ico)(\?|$)/i.test(u)) return;
      if (/api|graphql|destination|search|event/i.test(u)) ebHits.push({ m: r.method(), u });
    });
    page.on("response", async (r) => {
      const hit = ebHits.find((h) => h.u === r.url() && !h.s);
      if (!hit) return;
      try {
        const t = await r.text();
        if (t.trim().startsWith("{") || t.trim().startsWith("[")) hit.s = t.slice(0, 800);
      } catch {
        /* ignore */
      }
    });

    await page.goto(ebUrl, { waitUntil: "networkidle", timeout: 90_000 }).catch((e) => console.log(e.message));
    await page.waitForTimeout(4000);
    console.log("eb", page.url(), await page.title());
    console.log(
      (await page.evaluate(() => document.body.innerText.slice(0, 1000))).replace(/\s+/g, " ").slice(0, 500),
    );
    for (const h of ebHits.filter((x) => x.s).slice(0, 20)) {
      console.log(h.m, h.u.slice(0, 140));
      console.log(" ", h.s?.slice(0, 450));
    }

    // Try Eventbrite public destination API shape
    for (const path of [
      "https://www.eventbriteapi.com/v3/events/search/?location.address=Manila&expand=venue",
      "https://www.eventbrite.com/api/v3/destination/search/?q=&locations=Manila",
    ]) {
      try {
        const res = await page.request.get(path);
        console.log("probe", res.status(), path.slice(0, 80), (await res.text()).slice(0, 300));
      } catch (e) {
        console.log("probe fail", e instanceof Error ? e.message : e);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
