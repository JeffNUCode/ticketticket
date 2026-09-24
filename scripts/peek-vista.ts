/**
 * Dump Vista branch list + one schedule sample.
 *   node node_modules/tsx/dist/cli.mjs scripts/peek-vista.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";

const BASE = "https://www.vistacinemas.com.ph";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const branches = await page.request.get(`${BASE}/Branches/GetBranchesSlug`).then((r) => r.json());
    console.log(JSON.stringify(branches, null, 2));

    const movies = await page.request
      .get(`${BASE}/Movie/NowShowingMovies/`)
      .then((r) => r.json());
    const titles = (movies.NowShowingMovies as { MovieName: string }[]).map((m) => m.MovieName);
    console.log("\nmovies:", titles.join(" | "));

    const movie = titles[0];
    const branchKey = 1;
    const sched = await page.request.get(
      `${BASE}/Movie/Schedules?branchKey=${branchKey}&movieName=${encodeURIComponent(movie)}`,
    );
    console.log("\nschedule sample status", sched.status());
    console.log(await sched.text());
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
