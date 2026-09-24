/**
 * Turns SM OCAPI /sites into data/sm-cinemas.json (no emails, no phone numbers).
 * Needs data/sm-sites.raw.json from a prior dump, or pass --fetch to pull it.
 */
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { siteToCinema, type OcapiSite } from "../lib/sm";

const RAW = path.join(process.cwd(), "data/sm-sites.raw.json");
const OUT = path.join(process.cwd(), "data/sm-cinemas.json");

async function main() {
  const raw = JSON.parse(await readFile(RAW, "utf8")) as { sites: OcapiSite[] };
  if (!Array.isArray(raw.sites) || raw.sites.length === 0) {
    throw new Error("data/sm-sites.raw.json has no sites — run scripts/dump-sm-sites.ts first");
  }
  const rows = raw.sites.map(siteToCinema).sort((a, b) => a.mall.localeCompare(b.mall));
  await writeFile(OUT, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  const byCity = new Map<string, number>();
  for (const r of rows) byCity.set(r.city, (byCity.get(r.city) ?? 0) + 1);
  console.log(`wrote ${rows.length} SM cinemas to data/sm-cinemas.json`);
  [...byCity.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([k, n]) => console.log(`  ${k}: ${n}`));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
