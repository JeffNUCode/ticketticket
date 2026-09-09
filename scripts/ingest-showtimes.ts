import { readdir, readFile } from "fs/promises";
import path from "path";
import "./env";
import { SEED } from "../lib/seed";
import { cityOffset, parseSchedule, toIso } from "../lib/ingest";
import type { InventoryShow } from "../lib/inventory";
import { tmdbConfigured } from "../lib/tmdb";
import { createTitleMatcher } from "./match-title";
import { mergeAndWrite, type Touched } from "./inventory-io";

const RAW_DIR = path.join(process.cwd(), "data/raw");

async function main() {
  if (!tmdbConfigured()) throw new Error("TMDB_API_KEY not set — needed to match titles");

  const files = (await readdir(RAW_DIR).catch(() => [] as string[]))
    .filter((f) => f.endsWith(".txt") && !f.startsWith("_"))
    .sort();

  if (files.length === 0) {
    console.log(`no schedule files in data/raw (skipping files starting with "_")`);
    return;
  }

  const match = await createTitleMatcher();

  const parsed = [];
  for (const file of files) {
    const text = await readFile(path.join(RAW_DIR, file), "utf8");
    try {
      parsed.push({ file, schedule: parseSchedule(text) });
    } catch (e) {
      throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const rows: InventoryShow[] = [];
  const unmatched: string[] = [];
  const touched: Touched[] = [];

  for (const { file, schedule } of parsed) {
    const cinema = SEED.cinemas.find((c) => c.id === schedule.cinemaId);
    if (!cinema) {
      throw new Error(
        `${file}: unknown cinema "${schedule.cinemaId}" (see lib/seed.ts for valid ids)`,
      );
    }
    const offset = cityOffset(cinema.city);
    touched.push({ cinemaId: cinema.id, date: schedule.date });

    if (schedule.skipped.length) {
      console.log(`${file}: ignored ${schedule.skipped.length} non-title line(s)`);
      schedule.skipped.forEach((s) => console.log(`  - ${s}`));
    }

    for (const entry of schedule.entries) {
      const movieId = await match(entry.title);
      if (!movieId) {
        unmatched.push(`${file}: "${entry.title}"`);
        continue;
      }

      for (const time of entry.times) {
        let startTime: string;
        try {
          startTime = toIso(schedule.date, time, offset);
        } catch (e) {
          throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
        }
        rows.push({
          movie_id: movieId,
          title: entry.title,
          cinema_id: cinema.id,
          screen_type: entry.screenType,
          start_time: startTime,
          price: entry.price,
          booking_direct_url: cinema.website_booking_url,
        });
      }
    }
  }

  if (unmatched.length) {
    console.error("no TMDB match — fix the spelling, nothing was written:");
    unmatched.forEach((u) => console.error(`  ${u}`));
    process.exit(1);
  }

  const total = await mergeAndWrite(rows, touched);

  console.log(`ingested ${rows.length} showtimes from ${files.length} file(s)`);
  touched.forEach((t) => console.log(`  ${t.cinemaId} ${t.date}`));
  console.log(`data/showtimes.json now holds ${total} rows`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
