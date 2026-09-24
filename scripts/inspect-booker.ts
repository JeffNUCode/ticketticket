/**
 * Lists JSON endpoints a booker's page hits. Use this before writing a capture script —
 * SureSeats / Robinsons / Megaworld don't publish a feed, so the shape has to be read
 * from a real page the same way capture-sm.ts did for Vista OCAPI.
 *
 *   npm run inspect:booker
 *   npx tsx scripts/inspect-booker.ts --url=https://www.megaworldcinemas.com/
 */
import "./env";
import { launchBrowser, UA } from "./browser";

const DEFAULTS = [
  "https://www.robinsonsmovieworld.com/",
  "https://www.megaworldcinemas.com/",
];

async function inspect(url: string) {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const hits: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!/webservice|GetNowShowing|aspx\//i.test(u)) return;
    hits.push(`${r.method()} ${u}`);
  });
  try {
    console.log(`\n${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(3000);
    const list = [...new Set(hits)];
    if (list.length === 0) {
      console.log("  (no booker API calls seen)");
      return;
    }
    list.forEach((h) => console.log(`  ${h}`));
  } finally {
    await browser.close();
  }
}

async function main() {
  const only = process.argv.find((a) => a.startsWith("--url="))?.slice("--url=".length);
  const targets = only ? [only] : DEFAULTS;
  for (const target of targets) await inspect(target);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
