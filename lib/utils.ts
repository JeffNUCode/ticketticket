import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { cityInFilter } from "./cities";
import type { CitySlug, LocationFilterId } from "@/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Calendar key as a noon PH instant so `YYYY-MM-DD` does not shift a day in UTC. */
export function phNoon(dateKey: string) {
  return new Date(`${dateKey}T12:00:00+08:00`);
}

export const DATE_HORIZON = 30;

/** Dates this region actually has times for, from today, capped at DATE_HORIZON. Empty days are not invented. */
export function horizonDates(
  showtimes: { cinema: { city: string }; start_time: string }[],
  city: LocationFilterId,
  today: string,
  selected?: string,
) {
  const keys = [
    ...new Set(
      showtimes
        .filter((s) => cityInFilter(city, s.cinema.city as CitySlug))
        .map((s) => localDateKey(new Date(s.start_time)))
        .filter((d) => d >= today),
    ),
  ].sort();
  const clipped = keys.slice(0, DATE_HORIZON);
  if (selected && selected >= today && !clipped.includes(selected)) {
    return [...clipped, selected].sort();
  }
  return clipped.length ? clipped : [today];
}

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function peso(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Google Maps search — coords when known, else a place name / address query. */
export function mapsSearchUrl(query: string, lat?: number, lng?: number) {
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
