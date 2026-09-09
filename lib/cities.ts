import type { CitySlug } from "@/types/database";

export const CITIES: {
  slug: CitySlug;
  label: string;
  lat: number;
  lng: number;
}[] = [
  { slug: "metro-manila", label: "Metro Manila", lat: 14.5995, lng: 120.9842 },
  { slug: "cavite", label: "Cavite", lat: 14.3294, lng: 120.9367 },
  { slug: "cebu", label: "Cebu", lat: 10.3157, lng: 123.8854 },
  { slug: "davao", label: "Davao", lat: 7.1907, lng: 125.4553 },
  { slug: "bangkok", label: "Bangkok", lat: 13.7563, lng: 100.5018 },
];

export function nearestCity(lat: number, lng: number): CitySlug {
  let best: CitySlug = "metro-manila";
  let dist = Infinity;
  for (const city of CITIES) {
    const d = (city.lat - lat) ** 2 + (city.lng - lng) ** 2;
    if (d < dist) {
      dist = d;
      best = city.slug;
    }
  }
  return best;
}

export function cityLabel(slug: CitySlug) {
  return CITIES.find((c) => c.slug === slug)?.label ?? slug;
}

export function parseCity(v: string | undefined): CitySlug {
  return CITIES.some((c) => c.slug === v) ? (v as CitySlug) : "metro-manila";
}
