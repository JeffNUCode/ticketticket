/** Merge helpers for data/events.json */

import { readFile, writeFile } from "fs/promises";
import path from "path";
import type { GoSeeEvent } from "@/types/events";

const OUT = path.join(process.cwd(), "data/events.json");

export async function loadEventsFile(): Promise<GoSeeEvent[]> {
  try {
    const raw = await readFile(OUT, "utf8");
    const parsed = JSON.parse(raw) as GoSeeEvent[];
    return Array.isArray(parsed) ? parsed.filter((e) => e?.id && e?.title && e?.booking_url) : [];
  } catch {
    return [];
  }
}

/** Replace rows whose id is in `incoming`; keep everything else. */
export async function mergeEventsAndWrite(incoming: GoSeeEvent[], sourcePrefix?: string) {
  const existing = await loadEventsFile();
  const replaceIds = new Set(incoming.map((e) => e.id));
  const kept = existing.filter((e) => {
    if (replaceIds.has(e.id)) return false;
    if (sourcePrefix && e.id.startsWith(sourcePrefix)) return false;
    return true;
  });
  const merged = [...kept, ...incoming].sort(
    (a, b) =>
      (a.schedules[0]?.start_time ?? "").localeCompare(b.schedules[0]?.start_time ?? "") ||
      a.title.localeCompare(b.title),
  );
  await writeFile(OUT, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return merged.length;
}

export function smDateToIso(raw: string) {
  // "2026-10-10 18:00:00" → ISO with PH offset
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(raw.trim());
  if (!m) return null;
  return `${m[1]}T${m[2]}+08:00`;
}

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "October 15, 2026" / "15 October 2026" / "2026-10-15" → YYYY-MM-DD */
export function parseLooseDate(raw: string): string | null {
  const s = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const mdy =
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(
      s,
    );
  if (mdy) {
    const mo = MONTHS[mdy[1].toLowerCase()];
    if (mo) return `${mdy[3]}-${pad(mo)}-${pad(+mdy[2])}`;
  }

  const dmy =
    /^(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})$/i.exec(
      s,
    );
  if (dmy) {
    const mo = MONTHS[dmy[2].toLowerCase()];
    if (mo) return `${dmy[3]}-${pad(mo)}-${pad(+dmy[1])}`;
  }

  // "24 - 25 Sep" needs year from caller — not handled here
  return null;
}

/** "9:00 am" / "7:30 PM" / "19:00" → HH:MM:SS */
export function parseLooseTime(raw: string | undefined, fallback = "09:00:00"): string {
  if (!raw) return fallback;
  const m = /(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(raw.trim());
  if (!m) return fallback;
  let h = +m[1];
  const min = m[2];
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return `${pad(h)}:${min}:00`;
}

export function toPhIso(dateYmd: string, timeHms = "09:00:00") {
  return `${dateYmd}T${timeHms}+08:00`;
}

/**
 * "October 15-17, 2026" → start/end YMD.
 * "24 - 25 Sep" + year → start/end YMD.
 */
export function parseDateRange(raw: string, defaultYear?: number): { start: string; end?: string } | null {
  const s = raw.trim().replace(/\s+/g, " ");

  const long =
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s+(\d{4})$/i.exec(
      s,
    );
  if (long) {
    const mo = MONTHS[long[1].toLowerCase()];
    if (!mo) return null;
    const y = long[4];
    return {
      start: `${y}-${pad(mo)}-${pad(+long[2])}`,
      end: `${y}-${pad(mo)}-${pad(+long[3])}`,
    };
  }

  const single = parseLooseDate(s);
  if (single) return { start: single };

  const short = /^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?$/i.exec(
    s,
  );
  if (short) {
    const mo = MONTHS[short[3].toLowerCase()];
    const y = short[4] || defaultYear;
    if (!mo || !y) return null;
    return {
      start: `${y}-${pad(mo)}-${pad(+short[1])}`,
      end: `${y}-${pad(mo)}-${pad(+short[2])}`,
    };
  }

  const oneShort = /^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?$/i.exec(s);
  if (oneShort) {
    const mo = MONTHS[oneShort[2].toLowerCase()];
    const y = oneShort[3] || defaultYear;
    if (!mo || !y) return null;
    return { start: `${y}-${pad(mo)}-${pad(+oneShort[1])}` };
  }

  // "Sep 26 - 27 2026" / "Sep 26, 2026"
  const monFirstRange =
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\s*[-–]\s*(\d{1,2}),?\s+(\d{4})$/i.exec(
      s,
    );
  if (monFirstRange) {
    const mo = MONTHS[monFirstRange[1].toLowerCase()];
    if (!mo) return null;
    const y = monFirstRange[4];
    return {
      start: `${y}-${pad(mo)}-${pad(+monFirstRange[2])}`,
      end: `${y}-${pad(mo)}-${pad(+monFirstRange[3])}`,
    };
  }

  const monFirst =
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(s);
  if (monFirst) {
    const mo = MONTHS[monFirst[1].toLowerCase()];
    if (!mo) return null;
    return { start: `${monFirst[3]}-${pad(mo)}-${pad(+monFirst[2])}` };
  }

  return null;
}
