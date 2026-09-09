import "./env";
import { writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { chromium } from "playwright-core";

const API = "https://digital-api.smcinema.com/ocapi/v1";
const BOOT = "https://www.smcinema.com/sites/SM-City-Dasmarinas/2402";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function launchBrowser() {
  for (const channel of ["chrome", "msedge", "chromium"]) {
    try {
      return await chromium.launch({ channel });
    } catch {
      /* try next */
    }
  }
  throw new Error("no Chrome, Edge or Chromium found");
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const seen = page.waitForRequest((r) => r.url().includes("/ocapi/"), { timeout: 90_000 });
  try {
    await page.goto(BOOT, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const auth = (await seen).headers()["authorization"];
    if (!auth) throw new Error("no OCAPI auth");
    const res = await page.request.get(`${API}/sites`, {
      headers: { authorization: auth, accept: "application/json", correlationid: randomUUID() },
    });
    if (!res.ok()) throw new Error(`OCAPI ${res.status()} /sites`);
    const json = await res.json();
    const out = path.join(process.cwd(), "data/sm-sites.raw.json");
    await writeFile(out, `${JSON.stringify(json, null, 2)}\n`, "utf8");
    const sites = (json as { sites?: unknown[] }).sites ?? json;
    console.log(`wrote ${out}`);
    console.log("top keys:", Object.keys(json as object).join(", "));
    console.log("count:", Array.isArray(sites) ? sites.length : typeof sites);
    const first = Array.isArray(sites) ? sites[0] : null;
    if (first && typeof first === "object") console.log("sample keys:", Object.keys(first).join(", "));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
