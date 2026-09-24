import type { CitySlug, ScreenType } from "@/types/database";

const SCREENS: ScreenType[] = ["2D", "3D", "IMAX", "Director's Club"];

/** PH and TH have no DST, so a fixed offset is correct (not a shortcut). */
const CITY_OFFSET: Record<CitySlug, string> = {
  "metro-manila": "+08:00",
  cavite: "+08:00",
  "north-luzon": "+08:00",
  "south-luzon": "+08:00",
  cebu: "+08:00",
  visayas: "+08:00",
  davao: "+08:00",
  mindanao: "+08:00",
};

export function cityOffset(city: CitySlug) {
  return CITY_OFFSET[city];
}

export type ScheduleEntry = {
  title: string;
  screenType: ScreenType;
  price: number | null;
  times: string[];
};

export type ParsedSchedule = {
  cinemaId: string;
  date: string;
  entries: ScheduleEntry[];
  /** Lines dropped as page furniture. Reported, never silent — a mis-skipped title
   *  would hand its times to the movie above it. */
  skipped: string[];
};

/**
 * Chrome that comes along when you copy a cinema page. Matched whole-line only: a
 * prefix match would eat real titles like "Book Club" or "Cinema Paradiso".
 */
const NOISE = [
  /^(?:cinema|screen|hall|theatre|theater)\s*\d+[a-z]?$/i,
  /^[₱p]?\s*[\d,]+(?:\.\d{2})?$/,
  /^(?:g|pg|pg-?13|r-?13|r-?16|r-?18|nr|nyr)$/i,
  /^\d+\s*(?:h|hr|hrs|hour|hours)\s*(?:\d+\s*(?:m|min|mins|minutes)?)?$/i,
  /^\d+\s*(?:m|min|mins|minutes)$/i,
  /^(?:buy tickets?|book now|reserve seats?|select seats?|see times|view times)$/i,
  /^(?:now showing|coming soon|sold out|available|advance sale|advance booking)$/i,
];

/**
 * Ops paste format — what a human copies off the cinema's official page:
 *
 *   cinema: c-sm-mega
 *   date: 2026-09-10
 *
 *   Wicked: For Good | 2D | 320
 *   11:00 AM, 1:40 PM, 4:20 PM
 *
 * A line is treated as showtimes only when every comma-separated part parses as
 * a clock time, so bare movie titles still read as titles.
 */
export function parseSchedule(text: string): ParsedSchedule {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  let cinemaId = "";
  let date = "";
  const entries: ScheduleEntry[] = [];
  const skipped: string[] = [];

  for (const line of lines) {
    const header = /^(cinema|date)\s*:\s*(\S.*)$/i.exec(line);
    if (header && !line.includes("|")) {
      if (header[1].toLowerCase() === "cinema") cinemaId = header[2].trim();
      else date = header[2].trim();
      continue;
    }

    if (isTimesLine(line)) {
      if (entries.length === 0) {
        throw new Error(`times listed before any movie line: "${line}"`);
      }
      entries[entries.length - 1].times.push(
        ...line
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      );
      continue;
    }

    if (!line.includes("|") && NOISE.some((n) => n.test(line))) {
      skipped.push(line);
      continue;
    }

    const [rawTitle, rawScreen = "", rawPrice = ""] = line.split("|").map((p) => p.trim());
    if (!rawTitle) throw new Error(`movie line has no title: "${line}"`);
    entries.push({
      title: rawTitle,
      screenType: rawScreen ? normalizeScreen(rawScreen) : "2D",
      price: parsePrice(rawPrice),
      times: [],
    });
  }

  if (!cinemaId) throw new Error("missing `cinema:` header");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("missing or invalid `date:` header (expected YYYY-MM-DD)");
  }
  if (entries.length === 0) throw new Error("no movie lines parsed");
  for (const e of entries) {
    if (e.times.length === 0) throw new Error(`no showtimes listed for "${e.title}"`);
  }

  return { cinemaId, date, entries, skipped };
}

function isTimesLine(line: string) {
  if (line.includes("|")) return false;
  const parts = line
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 && parts.every((p) => parseTime(p) !== null);
}

function normalizeScreen(raw: string): ScreenType {
  const hit = SCREENS.find((s) => s.toLowerCase() === raw.toLowerCase());
  if (!hit) throw new Error(`unknown format "${raw}" (allowed: ${SCREENS.join(", ")})`);
  return hit;
}

function parsePrice(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[₱,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error(`bad price "${raw}"`);
  return n;
}

export function parseTime(raw: string): { hour: number; minute: number } | null {
  const t = raw.trim();

  const twelve = /^(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?m?\.?$/i.exec(t);
  if (twelve) {
    let hour = Number(twelve[1]);
    const minute = twelve[2] === undefined ? 0 : Number(twelve[2]);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const pm = twelve[3].toLowerCase() === "p";
    if (pm && hour !== 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
    return { hour, minute };
  }

  const military = /^(\d{1,2})[:.](\d{2})$/.exec(t);
  if (military) {
    const hour = Number(military[1]);
    const minute = Number(military[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute };
  }

  return null;
}

/**
 * Times are taken literally — a 12:30 AM row under Sep 10 becomes Sep 10 00:30.
 * Late shows must be dated by whoever types them; guessing a roll-over invents data.
 */
export function toIso(date: string, time: string, utcOffset: string) {
  const hm = parseTime(time);
  if (!hm) throw new Error(`bad time "${time}"`);
  const hh = String(hm.hour).padStart(2, "0");
  const mm = String(hm.minute).padStart(2, "0");
  return `${date}T${hh}:${mm}:00${utcOffset}`;
}

export function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "");
}

export function matchesCinema(
  cinema: { mall: string; name: string; address: string; chain: string },
  query: string,
) {
  const q = normalizeTitle(query);
  if (!q) return true;
  return [cinema.mall, cinema.name, cinema.address, cinema.chain].some((s) =>
    normalizeTitle(s).includes(q),
  );
}
