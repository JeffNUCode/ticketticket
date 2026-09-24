/**
 * Self-check for loose PH date parsing used by WTC/SMX/CCP captures.
 *   npx tsx scripts/check-event-dates.ts
 */
import assert from "assert";
import { parseDateRange, parseLooseDate, parseLooseTime, toPhIso } from "../lib/events-inventory";

assert.strictEqual(parseLooseDate("October 15, 2026"), "2026-10-15");
assert.strictEqual(parseLooseDate("15 October 2026"), "2026-10-15");
assert.deepStrictEqual(parseDateRange("October 15-17, 2026"), {
  start: "2026-10-15",
  end: "2026-10-17",
});
assert.deepStrictEqual(parseDateRange("24 - 25 Sep", 2026), {
  start: "2026-09-24",
  end: "2026-09-25",
});
assert.strictEqual(parseLooseTime("9:00 am"), "09:00:00");
assert.strictEqual(parseLooseTime("7:30 PM"), "19:30:00");
assert.strictEqual(toPhIso("2026-10-15", "09:00:00"), "2026-10-15T09:00:00+08:00");
assert.deepStrictEqual(parseDateRange("Sep 26 - 27 2026"), {
  start: "2026-09-26",
  end: "2026-09-27",
});
assert.deepStrictEqual(parseDateRange("Sep 26, 2026"), { start: "2026-09-26" });
console.log("ok event-date parse");
