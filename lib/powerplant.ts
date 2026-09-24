/** Power Plant Cinema — Vista WSVistaWebClient OData at therockwellist.com. */

import { phToday } from "./rob";
import type { ScreenType } from "@/types/database";

export const PP_SITE = "https://powerplantcinema.com/bin/homepage.php";
export const PP_ODATA = "https://powerplantcinemastickets.therockwellist.com/WSVistaWebClient/OData.svc";

export type PpCinema = {
  ID: string;
  Name: string;
  Address1?: string;
  Address2?: string;
  City?: string;
};

export type PpFilm = {
  ID: string;
  Title: string;
  IsScheduledAtCinema?: boolean;
};

export type PpSession = {
  ID: string;
  CinemaId: string;
  ScheduledFilmId: string;
  Showtime: string;
  ScreenName: string;
  SessionAttributesNames?: string[];
  AllowTicketSales?: boolean;
};

/** Vista CinemaId → our catalog id. */
export const PP_CINEMA_IDS: Record<string, string> = {
  "0001": "c-pp-makati",
  "0003": "c-pp-alabang",
};

export function ppScreenType(screenName: string, attrs: string[] = []): ScreenType {
  const u = `${screenName} ${attrs.join(" ")}`.toUpperCase();
  if (/IMAX/.test(u)) return "IMAX";
  if (/VIP|PREMIERE|DIRECTOR|LUXE|PREMIUM|DIRECTORS/.test(u)) return "Director's Club";
  if (/3D/.test(u)) return "3D";
  return "2D";
}

/** Vista returns wall-clock PH times without offset (China Standard Time = +08). */
export function ppShowtimeIso(raw: string) {
  if (!raw) return null;
  if (/[Zz]|[+-]\d{2}:\d{2}$/.test(raw)) return raw;
  return `${raw}+08:00`;
}

export function filterPpSessions(sessions: PpSession[], days: number) {
  const start = phToday();
  const end = new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
  return sessions.filter((s) => {
    const iso = ppShowtimeIso(s.Showtime);
    if (!iso) return false;
    const day = iso.slice(0, 10);
    return day >= start && day <= end;
  });
}
