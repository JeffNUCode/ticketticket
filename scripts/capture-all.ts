/**
 * Run every cinema chain + live-event capture in sequence.
 *   npm run capture
 *   npm run capture -- --days=14
 *   npm run capture -- --only=dasma
 *
 * Extra args are forwarded to cinema scripts only (events ignore them).
 */
import { spawnSync } from "child_process";
import path from "path";

const CHAINS = [
  "sm",
  "megaworld",
  "robinsons",
  "ayala",
  "vista",
  "fisher",
  "powerplant",
] as const;

const EVENTS = ["sm-tickets", "eventbrite", "wtc", "ccp", "smx"] as const;

const extra = process.argv.slice(2);
const tsx = path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs");

function run(label: string, script: string, args: string[] = []) {
  console.log(`\n======== capture:${label} ========`);
  const r = spawnSync(process.execPath, [tsx, script, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`capture:${label} exited ${r.status ?? "null"}`);
    return false;
  }
  return true;
}

let failed = 0;
const total = CHAINS.length + EVENTS.length;

for (const chain of CHAINS) {
  if (!run(chain, `scripts/capture-${chain}.ts`, extra)) failed++;
}

for (const ev of EVENTS) {
  if (!run(ev, `scripts/capture-${ev}.ts`)) failed++;
}

if (failed) {
  console.error(`\n${failed}/${total} capture(s) failed`);
  process.exit(1);
}
console.log(`\nall ${total} capture(s) done (cinema + events)`);
