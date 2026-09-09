import assert from "assert";
import { cityOffset, parseSchedule, toIso } from "../lib/ingest";
import { applyLocalTitles, missingMovieIds } from "../lib/inventory";
import { DATE_HORIZON, horizonDates } from "../lib/utils";
import type { MovieRow, ShowtimeRow } from "../types/database";

const schedule = parseSchedule(`
# comment
cinema: c-sm-mega
date: 2026-09-10

Wicked: For Good | IMAX | ₱1,020
11:00 AM, 1:40 PM
7 pm

Zootopia 2
10:30, 22:15
`);

assert.equal(schedule.cinemaId, "c-sm-mega");
assert.equal(schedule.date, "2026-09-10");
assert.equal(schedule.entries.length, 2);

const [first, second] = schedule.entries;
assert.equal(first.screenType, "IMAX");
assert.equal(first.price, 1020);
assert.deepEqual(first.times, ["11:00 AM", "1:40 PM", "7 pm"]);
assert.equal(second.screenType, "2D", "format defaults to 2D");
assert.equal(second.price, null);

// Page furniture from a raw copy-paste is dropped, but reported so a mis-skip is visible.
const pasted = parseSchedule(`
cinema: c-sm-mega
date: 2026-09-10

Cinema 5
Wicked: For Good
PG-13
2h 45m
₱350.00
11:00 AM
Buy Tickets

Book Club
1:40 PM
`);
assert.deepEqual(
  pasted.skipped,
  ["Cinema 5", "PG-13", "2h 45m", "₱350.00", "Buy Tickets"],
  "furniture skipped and reported",
);
assert.deepEqual(
  pasted.entries.map((e) => e.title),
  ["Wicked: For Good", "Book Club"],
  "a title that looks like a UI label is still a title",
);
assert.deepEqual(pasted.entries[0].times, ["11:00 AM"]);

const ph = cityOffset("metro-manila");
assert.equal(toIso("2026-09-10", "11:00 AM", ph), "2026-09-10T11:00:00+08:00");
assert.equal(toIso("2026-09-10", "1:40 PM", ph), "2026-09-10T13:40:00+08:00");
assert.equal(toIso("2026-09-10", "7 pm", ph), "2026-09-10T19:00:00+08:00");
assert.equal(toIso("2026-09-10", "12:15 AM", ph), "2026-09-10T00:15:00+08:00");
assert.equal(toIso("2026-09-10", "12:15 PM", ph), "2026-09-10T12:15:00+08:00");
assert.equal(toIso("2026-09-10", "22:15", ph), "2026-09-10T22:15:00+08:00");
assert.equal(cityOffset("bangkok"), "+07:00");

// Bad input must fail loudly rather than land wrong times in the DB.
assert.throws(() => toIso("2026-09-10", "25:00", ph), /bad time/);
assert.throws(() => toIso("2026-09-10", "noon", ph), /bad time/);
assert.throws(() => toIso("2026-09-10", "13:40 PM", ph), /bad time/);
assert.throws(() => parseSchedule("date: 2026-09-10\nFoo | 2D\n1:00 PM"), /cinema/);
assert.throws(() => parseSchedule("cinema: c-sm-mega\nFoo | 2D\n1:00 PM"), /date/);
assert.throws(() => parseSchedule("cinema: c\ndate: 2026-09-10\n1:00 PM"), /before any movie/);
assert.throws(
  () => parseSchedule("cinema: c\ndate: 2026-09-10\nFoo | 4DX\n1:00 PM"),
  /unknown format/,
);
assert.throws(() => parseSchedule("cinema: c\ndate: 2026-09-10\nFoo | 2D"), /no showtimes/);

// Re-runs and local classics have showtimes but sit outside TMDB's now-playing window;
// they must be reported as missing so the catalog hydrates them instead of dropping the rows.
const rows = [
  { movie_id: "tmdb-969681" },
  { movie_id: "tmdb-197976" },
  { movie_id: "tmdb-197976" },
] as ShowtimeRow[];
assert.deepEqual(missingMovieIds(rows, [{ id: "tmdb-969681" }]), ["tmdb-197976"]);
assert.deepEqual(missingMovieIds(rows, [{ id: "tmdb-969681" }, { id: "tmdb-197976" }]), []);

// The billed title wins over TMDB's English export title, and the slug follows it.
const tmdbRows = [
  { id: "tmdb-197976", title: "Miracle", slug: "miracle-197976" },
  { id: "tmdb-969681", title: "Spider-Man: Brand New Day", slug: "spider-man-brand-new-day-969681" },
] as MovieRow[];
const retitled = applyLocalTitles(tmdbRows, new Map([["tmdb-197976", "Himala"]]));
assert.equal(retitled[0].title, "Himala");
assert.equal(retitled[0].slug, "himala-197976");
assert.equal(retitled[1], tmdbRows[1], "untouched movies keep their identity");
assert.equal(applyLocalTitles(tmdbRows, new Map())[0].title, "Miracle");

const horizonRows = [
  { cinema: { city: "cavite" }, start_time: "2026-09-08T20:00:00+08:00" },
  { cinema: { city: "cavite" }, start_time: "2026-09-10T11:00:00+08:00" },
  { cinema: { city: "cavite" }, start_time: "2026-09-16T13:00:00+08:00" },
  { cinema: { city: "cebu" }, start_time: "2026-09-20T13:00:00+08:00" },
];
assert.deepEqual(horizonDates(horizonRows, "cavite", "2026-09-09"), ["2026-09-10", "2026-09-16"]);
assert.deepEqual(horizonDates(horizonRows, "metro-manila", "2026-09-09"), ["2026-09-09"]);
assert.equal(DATE_HORIZON, 30);

console.log("ok ingest parser");
