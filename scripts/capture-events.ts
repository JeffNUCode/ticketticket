/**
 * Live-event sources only (cinema stays on `npm run capture` / capture-*.ts).
 *   npm run capture:events
 */
import { spawnSync } from "child_process";
import path from "path";

const EVENTS = ["sm-tickets", "eventbrite", "wtc", "ccp", "smx"] as const;
const tsx = path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs");

let failed = 0;
for (const ev of EVENTS) {
  console.log(`\n======== capture:${ev} ========`);
  const r = spawnSync(process.execPath, [tsx, `scripts/capture-${ev}.ts`], {
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    failed++;
    console.error(`capture:${ev} exited ${r.status ?? "null"}`);
  }
}

if (failed) {
  console.error(`\n${failed}/${EVENTS.length} event capture(s) failed`);
  process.exit(1);
}
console.log(`\nall ${EVENTS.length} event capture(s) done`);
