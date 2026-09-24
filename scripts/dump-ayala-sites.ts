/**
 * Dump Ayala All Access Vista sites (same OCAPI shape as SM).
 *   node node_modules/tsx/dist/cli.mjs scripts/dump-ayala-sites.ts
 */
import "./env";
import { writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { launchBrowser, UA } from "./browser";

const API = "https://digital-api.ayalaallaccess.com/ocapi/v1";
const BOOT = "https://www.ayalaallaccess.com/";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const seen = page.waitForRequest((r) => r.url().includes("/ocapi/"), { timeout: 90_000 });
  try {
    await page.goto(BOOT, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const auth = (await seen).headers()["authorization"];
    if (!auth) throw new Error("no OCAPI auth");

    for (const pathName of [
      "/sites",
      "/film-screening-dates?siteIds=1003",
      "/showtimes/by-business-date/2026-09-21?siteIds=1003",
    ]) {
      const res = await page.request.get(`${API}${pathName}`, {
        headers: { authorization: auth, accept: "application/json", correlationid: randomUUID() },
      });
      console.log(pathName, res.status());
      if (!res.ok()) {
        console.log(" ", (await res.text()).slice(0, 200));
        continue;
      }
      const json = await res.json();
      if (pathName === "/sites") {
        const out = path.join(process.cwd(), "data/ayala-sites.raw.json");
        await writeFile(out, `${JSON.stringify(json, null, 2)}\n`, "utf8");
        const sites = (json as { sites?: { id: string; name?: { text?: string } }[] }).sites ?? [];
        console.log(`wrote ${out} (${sites.length} sites)`);
        for (const s of sites) console.log(`  ${s.id}\t${s.name?.text ?? "?"}`);
      } else {
        console.log(" ", JSON.stringify(json).slice(0, 600));
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
