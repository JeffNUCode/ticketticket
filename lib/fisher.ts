/** fisherboxoffice.fishermall.com.ph — ASP.NET GetCinemaSchedules. */

import { toIso } from "./ingest";
import { parseRobJson, phToday } from "./rob";
import type { ScreenType } from "@/types/database";

export const FISHER_SITE = "https://fisherboxoffice.fishermall.com.ph";

export type FisherTime = {
  Id: number;
  Value: string;
  Price: number;
};

export type FisherCinema = {
  Id: number;
  Name: string;
  ScreeningTimes: FisherTime[];
};

export type FisherDate = {
  Value: string;
  Cinemas: FisherCinema[];
};

export type FisherMovie = {
  Title: string;
  Code: string;
  ScreeningDates: FisherDate[];
};

export type FisherBranch = {
  BranchId: number;
  BranchName: string;
  Movies: FisherMovie[];
};

export function parseFisherSchedules(raw: string): FisherBranch[] {
  const parsed = parseRobJson<FisherBranch[]>(raw);
  return Array.isArray(parsed) ? parsed : [];
}

/** "September 23, 2026" → YYYY-MM-DD (PH calendar day). */
export function fisherDateToIso(label: string) {
  const d = new Date(`${label.trim()} 12:00:00 GMT+0800`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function fisherScreenType(cinemaName: string): ScreenType {
  const u = cinemaName.toUpperCase();
  if (/IMAX/.test(u)) return "IMAX";
  if (/VIP|PREMIERE|DIRECTOR|LUXE|PREMIUM/.test(u)) return "Director's Club";
  if (/3D/.test(u)) return "3D";
  return "2D";
}

export function filterFisherDays(isoDates: string[], days: number) {
  const start = phToday();
  const end = new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
  return isoDates.filter((d) => d >= start && d <= end);
}

export function fisherStartIso(dateLabel: string, timeLabel: string) {
  const day = fisherDateToIso(dateLabel);
  if (!day) return null;
  try {
    return toIso(day, timeLabel, "+08:00");
  } catch {
    return null;
  }
}

/** Fisher currently has one online branch (Quezon Avenue). */
export const FISHER_BRANCH_IDS: Record<number, string> = {
  1: "c-fisher-quezon",
  2: "c-fisher-malabon",
};
