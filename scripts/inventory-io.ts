import { readFile, writeFile } from "fs/promises";
import path from "path";
import type { InventoryShow } from "../lib/inventory";

const OUT_FILE = path.join(process.cwd(), "data/showtimes.json");

/** A cinema-day we just re-read, so stale rows for it get replaced rather than doubled. */
export type Touched = { cinemaId: string; date: string };

export async function mergeAndWrite(rows: InventoryShow[], touched: Touched[]) {
  let existing: InventoryShow[] = [];
  try {
    const parsed = JSON.parse(await readFile(OUT_FILE, "utf8"));
    if (Array.isArray(parsed)) existing = parsed as InventoryShow[];
  } catch {
    /* first run */
  }

  const kept = existing.filter(
    (r) => !touched.some((t) => r.cinema_id === t.cinemaId && r.start_time.startsWith(t.date)),
  );

  const seen = new Set<string>();
  const merged = [...kept, ...rows]
    .filter((r) => {
      const k = `${r.movie_id}|${r.cinema_id}|${r.start_time}|${r.screen_type}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort(
      (a, b) =>
        a.start_time.localeCompare(b.start_time) || a.cinema_id.localeCompare(b.cinema_id),
    );

  await writeFile(OUT_FILE, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged.length;
}
