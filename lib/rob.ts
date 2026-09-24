/** robinsonsmovieworld.com ASP.NET webservices — needs an in-page POST session. */

import type { ScreenType } from "@/types/database";

export const ROB_SITE = "https://robinsonsmovieworld.com";

/** ASP.NET returns JSON as a quoted string; the site's $.ajax success handlers parse twice. */
export function parseRobJson<T>(raw: string): T {
  if (!raw || raw === "undefined") throw new Error("empty Robinsons API response");
  const once = JSON.parse(raw) as unknown;
  return (typeof once === "string" ? JSON.parse(once) : once) as T;
}

export type RobBranch = {
  Branch_Key: number;
  Branch_Name: string;
  Branch_Code: string;
  HasVip: boolean;
};

export type RobMovie = {
  Movie_Name: string;
  Movie_Code: string;
  HasSchedule: number;
  FilmFormat: number;
  CinemaType: number;
};

export type RobScreening = {
  ScreeningDate: string;
  MovieCode: string;
  MovieFormat: string;
};

export type RobSlot = {
  cinemaName: string;
  startTime: string;
  price: number | null;
  screeningType: string;
  mctKey: number;
};

export function dotNetToIsoDate(raw: string) {
  const m = /\/Date\((\d+)\)\//.exec(raw);
  if (!m) return null;
  return new Date(Number(m[1])).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/** Site uses MM-DD-YYYY for getschedulesbybranchandmovie. */
export function robScheduleDate(dotNetDate: string) {
  const iso = dotNetToIsoDate(dotNetDate);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}-${d}-${y}`;
}

export function phToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function filterRobDates(dotNetDates: string[], days: number) {
  const start = phToday();
  const end = new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
  return dotNetDates.filter((raw) => {
    const iso = dotNetToIsoDate(raw);
    return iso && iso >= start && iso <= end;
  });
}

/** .NET /Date(ms)/ → ISO instant in PH (+08:00). */
export function dotNetToPhIso(raw: string) {
  const m = /\/Date\((\d+)\)\//.exec(raw);
  if (!m) return null;
  const d = new Date(Number(m[1]));
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
}

export function robScreenType(format: string, screeningType?: string): ScreenType {
  const u = `${format} ${screeningType ?? ""}`.toUpperCase();
  if (/IMAX/.test(u)) return "IMAX";
  if (/VIP|DIRECTOR|A-LUXE|ALUXE/.test(u)) return "Director's Club";
  if (/3D/.test(u)) return "3D";
  return "2D";
}

export function parseRobSchedules(raw: string): RobSlot[] {
  const rows = parseRobJson<{
    Cinema_Name: string;
    MCT_Key: number;
    Screening_Type: string;
    Price: number;
    Start_Time: string;
  }[]>(raw);
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    cinemaName: r.Cinema_Name,
    startTime: r.Start_Time,
    price: Number.isFinite(r.Price) ? r.Price : null,
    screeningType: r.Screening_Type,
    mctKey: r.MCT_Key,
  }));
}

export function normRobName(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/gi, "n")
    .toUpperCase()
    .replace(/ROBINSONS?/g, "")
    .replace(/PLACE/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/**
 * API Branch_Name → our cinema id for names that collide under fuzzy matching
 * (GALLERIA CEBU must not steal GALLERIA ORTIGAS; NORTH TACLOBAN ≠ TACLOBAN).
 */
export const ROB_BRANCH_IDS: Record<string, string> = {
  "GALLERIA ORTIGAS": "c-rob-galleria",
  "GALLERIA CEBU": "c-rob-galleria-cebu",
  "GALLERIA SOUTH": "c-rob-galleria-south",
  "NORTH TACLOBAN": "c-rob-north-tacloban",
  TACLOBAN: "c-rob-tacloban",
  "LAS PINAS": "c-rob-las-pinas",
  "STA. ROSA": "c-rob-sta-rosa",
  "STA ROSA": "c-rob-sta-rosa",
  "GENERAL TRIAS": "c-rob-gen-trias",
  "METRO EAST": "c-rob-metro-east",
  ILOCOS: "c-rob-ilocos",
  GENSAN: "c-rob-gensan",
  "GENERAL SANTOS": "c-rob-gensan",
  DASMARINAS: "c-rob-dasma",
};

/** Exact match only — substring matching wrongly maps GALLERIA CEBU → Ortigas. */
export function matchRobBranch(name: string, mall: string, cinemaName: string) {
  const b = normRobName(name);
  const m = normRobName(mall);
  const c = normRobName(cinemaName);
  return b === m || b === c;
}

/** Resolve API branch to a catalog cinema id. Prefer explicit aliases, then exact name. */
export function resolveRobCinemaId(
  branchName: string,
  cinemas: { id: string; mall: string; name: string }[],
) {
  const aliased = ROB_BRANCH_IDS[branchName.toUpperCase()];
  if (aliased && cinemas.some((c) => c.id === aliased)) return aliased;
  const hit = cinemas.find((c) => matchRobBranch(branchName, c.mall, c.name));
  return hit?.id ?? null;
}
