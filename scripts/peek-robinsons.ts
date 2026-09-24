/**
 * Prove Robinsons branch → film → date → clock time chain.
 *   node node_modules/tsx/dist/cli.mjs scripts/peek-robinsons.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";
import { dotNetToIsoDate, parseRobJson, robScheduleDate, parseRobSchedules } from "../lib/rob";

const BASE = "https://robinsonsmovieworld.com";
const BOOK =
  "U2FsdGVkX1%2BoDiaKZmhsw5C0eWxifPXLANEH13TdNBrFLuiKs8Km1kO9EeaqEb8Jm7YQeUO6%2B4jBxSCbQa8TD5aQcas0QDqYqljMBuVEiqNdV6pnsiKcuD%2FDbAcxO6BgH%2FZ9FnsjMNtPo%2FDVyEEySg%3D%3D";

async function post(page: import("playwright-core").Page, path: string) {
  return page.evaluate(async (p) => {
    const res = await fetch(p, { method: "POST", credentials: "include" });
    return await res.text();
  }, path);
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const captured = new Map<string, string>();
  page.on("response", async (r) => {
    const path = r.url().replace(BASE, "");
    if (path.startsWith("/webservice/")) {
      try {
        captured.set(path, await r.text());
      } catch {
        /* ignore */
      }
    }
  });

  try {
    await page.goto(`${BASE}/cinema/bookmovie?data=${BOOK}`, {
      waitUntil: "networkidle",
      timeout: 90_000,
    });
    await page.waitForTimeout(8000);
    console.log("captured paths", [...captured.keys()].join("\n"));

    const branchKey = 12;
    const movie = "LIFE AFTER YOU";
    const screeningPath = `/webservice/GetScreeningDetailsList?branchKey=${branchKey}&movieName=${encodeURIComponent(movie)}`;
    let screeningRaw = captured.get(screeningPath);
    if (!screeningRaw) {
      screeningRaw = await post(page, screeningPath);
    }
    console.log("screening raw", screeningRaw.slice(0, 400));
    const screening = parseRobJson<{ Data: { ScreeningDate: string; MovieCode: string; MovieFormat: string }[] }>(
      screeningRaw,
    );
    const row = screening.Data?.[0];
    if (!row) throw new Error(`no screening rows: ${screeningRaw.slice(0, 200)}`);
    const movieDate = robScheduleDate(row.ScreeningDate);
    const movieCode = row.MovieCode;
    console.log("screening", { movieDate, movieCode, format: row.MovieFormat });

    const momentDate = await page.evaluate((dotNet) => {
      const m = (window as unknown as { moment?: (d: string) => { format: (f: string) => string } }).moment;
      return m ? m(dotNet).format("MM-DD-YYYY") : null;
    }, row.ScreeningDate);
    console.log("moment date", momentDate);

    await page.selectOption("#select-schedule-bm", { index: 1 }).catch(() => {});
    await page.click("text=2D").catch(() => {});
    await page.waitForTimeout(3000);
    const schedHit = [...captured.keys()].find((k) => k.includes("getschedulesbybranchandmovie"));
    console.log("schedule capture", schedHit, schedHit ? captured.get(schedHit)?.slice(0, 800) : "none");

    const md = momentDate ?? movieDate;
    const raw =
      (schedHit ? captured.get(schedHit) : null) ??
      await page.evaluate(
        async ({ movieDate: d, branchKey: b, movieCode: c }) => {
          const w = window as unknown as {
            baseUrl?: string;
            $?: { ajax: (o: object) => void };
          };
          if (!w.$) return "no-jquery";
          return await new Promise<string>((resolve) => {
            w.$!.ajax({
              url: `${w.baseUrl ?? "/"}webservice/getschedulesbybranchandmovie?movieDate=${d}&branchId=${b}&movieCode=${c}`,
              type: "POST",
              success: (data: string) => resolve(data),
              error: (xhr: { status: number; responseText: string }) =>
                resolve(`ERR ${xhr.status} ${xhr.responseText.slice(0, 300)}`),
            });
          });
        },
        { movieDate: md, branchKey, movieCode },
      );
    console.log("\ngetschedulesbybranchandmovie sample:", raw.slice(0, 1500));
    const slots = parseRobSchedules(raw);
    console.log("\nparsed slots:", slots.slice(0, 10));
    console.log("dotNet date iso", dotNetToIsoDate(row.ScreeningDate));
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
