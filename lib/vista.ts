/** vistacinemas.com.ph (Parallax / myCinema) — Vista Mall + Starmall. */

import type { ScreenType } from "@/types/database";
import { dotNetToPhIso, filterRobDates } from "./rob";

export const VISTA_SITE = "https://www.vistacinemas.com.ph";

export type VistaBranch = {
  Branch_Key: number;
  Branch_Name: string;
  Branch_Code: string | null;
  Branch_Slug: string;
};

export type VistaMovie = {
  MovieName: string;
  HasSchedule?: number;
};

export type VistaSlot = {
  cinemaName: string;
  filmFormat: string;
  start: string;
  price: number | null;
  mctKey: number;
};

type VistaScheduleDay = {
  ScreeningDate: string;
  Cinemas: {
    Name: string;
    FilmFormat: string;
    Schedules: {
      MCTKey: number;
      Start: string;
      Price: number;
      Lapsed?: string;
    }[];
  }[];
};

export { dotNetToPhIso, filterRobDates };

export function vistaScreenType(format: string): ScreenType {
  const u = format.toUpperCase();
  if (/IMAX/.test(u)) return "IMAX";
  if (/VIP|DIRECTOR|A-LUXE|ALUXE|PREMIUM/.test(u)) return "Director's Club";
  if (/3D/.test(u)) return "3D";
  return "2D";
}

export function parseVistaSchedules(raw: unknown, days: number): VistaSlot[] {
  if (!Array.isArray(raw)) return [];
  const daysKept = filterRobDates(
    (raw as VistaScheduleDay[]).map((d) => d.ScreeningDate).filter(Boolean),
    days,
  );
  const keep = new Set(daysKept);
  const out: VistaSlot[] = [];
  for (const day of raw as VistaScheduleDay[]) {
    if (!keep.has(day.ScreeningDate)) continue;
    for (const cinema of day.Cinemas ?? []) {
      for (const s of cinema.Schedules ?? []) {
        if (!s.Start) continue;
        out.push({
          cinemaName: cinema.Name,
          filmFormat: cinema.FilmFormat || "2D",
          start: s.Start,
          price: Number.isFinite(s.Price) ? s.Price : null,
          mctKey: s.MCTKey,
        });
      }
    }
  }
  return out;
}

export function normVistaName(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/gi, "n")
    .toUpperCase()
    .replace(/VISTA CINEMAS?(?: AT)?/g, "")
    .replace(/STARMALL CINEMAS?/g, "STARMALL")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** API Branch_Key → catalog id (stable; names vary). */
export const VISTA_BRANCH_IDS: Record<number, string> = {
  7: "c-vista-starmall-shaw",
  17: "c-vista-starmall-san-jose",
  1: "c-vista-evia",
  4: "c-vista-bataan",
  14: "c-vista-dasma",
  13: "c-vista-gen-trias",
  11: "c-vista-iloilo",
  6: "c-vista-las-pinas",
  15: "c-vista-malolos",
  10: "c-vista-naga",
  16: "c-vista-nomo",
  5: "c-vista-pampanga",
  8: "c-vista-somo",
  3: "c-vista-sta-rosa",
  2: "c-vista-taguig",
  12: "c-vista-tanza",
};

export function resolveVistaCinemaId(
  branch: Pick<VistaBranch, "Branch_Key" | "Branch_Name">,
  cinemas: { id: string; mall: string; name: string }[],
) {
  const aliased = VISTA_BRANCH_IDS[branch.Branch_Key];
  if (aliased && cinemas.some((c) => c.id === aliased)) return aliased;
  const b = normVistaName(branch.Branch_Name);
  const hit = cinemas.find((c) => {
    const m = normVistaName(c.mall);
    const n = normVistaName(c.name);
    return b === m || b === n || m.includes(b) || b.includes(m);
  });
  return hit?.id ?? null;
}
