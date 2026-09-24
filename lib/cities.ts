import type { CitySlug, LocationFilterId } from "@/types/database";

/** Fine-grained centroids for GPS / distance (not all are picker chips). */
export const CITIES: {
  slug: CitySlug;
  label: string;
  lat: number;
  lng: number;
}[] = [
  { slug: "metro-manila", label: "Metro Manila", lat: 14.5995, lng: 120.9842 },
  { slug: "cavite", label: "Cavite", lat: 14.3294, lng: 120.9367 },
  { slug: "north-luzon", label: "North Luzon", lat: 15.4827, lng: 120.5986 },
  { slug: "south-luzon", label: "South Luzon", lat: 14.1, lng: 121.15 },
  { slug: "cebu", label: "Cebu", lat: 10.3157, lng: 123.8854 },
  { slug: "visayas", label: "Visayas", lat: 10.7202, lng: 122.5621 },
  { slug: "davao", label: "Davao", lat: 7.1907, lng: 125.4553 },
  { slug: "mindanao", label: "Mindanao", lat: 8.4542, lng: 124.6319 },
];

const ALL_CITY_SLUGS: CitySlug[] = CITIES.map((c) => c.slug);

/**
 * Inventory still uses fine-grained CitySlug (cavite, cebu, davao, …).
 * The location picker shows fewer chips — each chip covers one or more of those.
 */
export const LOCATION_FILTERS: {
  id: LocationFilterId;
  label: string;
  cities: CitySlug[];
}[] = [
  { id: "all", label: "All", cities: ALL_CITY_SLUGS },
  { id: "metro-manila", label: "Metro Manila", cities: ["metro-manila"] },
  { id: "north-luzon", label: "North Luzon", cities: ["north-luzon"] },
  { id: "south-luzon", label: "South Luzon", cities: ["south-luzon", "cavite"] },
  { id: "visayas", label: "Visayas", cities: ["visayas", "cebu"] },
  { id: "mindanao", label: "Mindanao", cities: ["mindanao", "davao"] },
];

/** Cities included when this filter (or any member city) is selected. */
export function citiesInFilter(city: LocationFilterId): CitySlug[] {
  if (city === "all") return [...ALL_CITY_SLUGS];
  const hit = LOCATION_FILTERS.find(
    (f) => f.id !== "all" && (f.id === city || f.cities.includes(city)),
  );
  return hit ? [...hit.cities] : [city as CitySlug];
}

/** Map a fine city or filter id to the picker chip (never snaps GPS to All). */
export function filterIdForCity(city: LocationFilterId): LocationFilterId {
  if (city === "all") return "all";
  return (
    LOCATION_FILTERS.find((f) => f.id !== "all" && (f.id === city || f.cities.includes(city)))?.id ??
    "metro-manila"
  );
}

export function cityInFilter(selected: LocationFilterId, candidate: CitySlug) {
  return citiesInFilter(selected).includes(candidate);
}

export function nearestCity(lat: number, lng: number, allowed?: CitySlug[]): LocationFilterId {
  const pool = allowed?.length ? CITIES.filter((c) => allowed.includes(c.slug)) : CITIES;
  let best: CitySlug = pool[0]?.slug ?? "metro-manila";
  let dist = Infinity;
  for (const city of pool) {
    const d = (city.lat - lat) ** 2 + (city.lng - lng) ** 2;
    if (d < dist) {
      dist = d;
      best = city.slug;
    }
  }
  return filterIdForCity(best);
}

export function cityLabel(slug: LocationFilterId) {
  return (
    LOCATION_FILTERS.find((f) => f.id === slug)?.label ??
    CITIES.find((c) => c.slug === slug)?.label ??
    slug
  );
}

export function parseCity(v: string | undefined, fallback?: string): LocationFilterId {
  if (v === "all" || fallback === "all") return "all";
  // Dropped Bangkok — old cookies/URLs land on Metro Manila.
  if (v === "bangkok" || fallback === "bangkok") return "metro-manila";
  if (v && CITIES.some((c) => c.slug === v)) return filterIdForCity(v as CitySlug);
  if (fallback && CITIES.some((c) => c.slug === fallback)) return filterIdForCity(fallback as CitySlug);
  return "metro-manila";
}

/** Survives a reload so Cavite doesn't snap back to Metro Manila. */
export const CITY_COOKIE = "gosee-city";

export function cityCookie(value: LocationFilterId) {
  return `${CITY_COOKIE}=${value};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
}

/** GPS pin from "Near me". City centroid is the fallback so the list is never A–Z. */
export const ORIGIN_KEY = "gosee-origin";

export function writeOrigin(lat: number, lng: number) {
  sessionStorage.setItem(ORIGIN_KEY, JSON.stringify({ lat, lng }));
}

export function readOrigin(): { lat: number; lng: number } | null {
  try {
    const raw = sessionStorage.getItem(ORIGIN_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { lat: number; lng: number };
    return Number.isFinite(o.lat) && Number.isFinite(o.lng) ? o : null;
  } catch {
    return null;
  }
}

/** PH geographic mid when All is selected and there's no GPS pin. */
const PH_CENTER = { lat: 12.8797, lng: 121.774 };

export function cityCenter(slug: LocationFilterId) {
  if (slug === "all") return PH_CENTER;
  const id = filterIdForCity(slug);
  const c = CITIES.find((c) => c.slug === id) ?? CITIES.find((c) => c.slug === slug);
  return c ? { lat: c.lat, lng: c.lng } : PH_CENTER;
}

export function hasChosenCity(query?: string, cookie?: string) {
  if (query === "all" || cookie === "all") return true;
  if (query === "bangkok" || cookie === "bangkok") return true; // treat as chosen → parseCity remaps
  return CITIES.some((c) => c.slug === query) || CITIES.some((c) => c.slug === cookie);
}

function hay(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n");
}

/**
 * Maps an address blob to a GoSee region. Specific cities (Cavite, Cebu, Davao, NCR)
 * win over the broader Luzon / Visayas / Mindanao buckets. Shared by every chain.
 *
 * Luzon regions are matched before Visayas so street names like "M.A. Roxas Highway"
 * (Clark / Angeles) don't land in Capiz.
 */
export function assignArea(text: string): CitySlug {
  const t = hay(text);
  if (
    /(cagayan de oro|\bcdo downtown|\bcdo\b|misamis|butuan|gensan|general santos|zamboanga|mindpro|iligan|valencia|tagum)/.test(
      t,
    )
  ) {
    return "mindanao";
  }
  if (/\bdavao\b|lanang/.test(t)) return "davao";
  if (/\bcebu\b|mandaue|consolacion/.test(t)) return "cebu";
  if (/\bcavite\b|bacoor|molino|trece martires|\btanza\b|dasmarin|\bimus\b|vermosa|general trias/.test(t)) {
    return "cavite";
  }
  if (
    /(quezon city|manila city|\bermita\b|sta\.? cruz manila|las pinas|paranaque|pasay|mandaluyong|pasig|taguig|muntinlupa|marikina|caloocan|valenzuela|novaliches|north edsa|sta\.? mesa|fairview|mall of asia|megamall|the podium|light residences|sangandaan|grand central|east ortigas|san lazaro|sucat|bicutan|aura premier|global city|sm city manila|sm city valenzuela|greenbelt|glorietta|trinoma|vertis|cloverleaf|binondo|eastwood|newport|makati)/.test(
      t,
    )
  ) {
    return "metro-manila";
  }
  if (
    /(pampanga|baguio|bulacan|tarlac|pangasinan|isabela|tuguegarao|\bcagayan\b|olongapo|zambales|\bclark\b|angeles|mabalacat|urdaneta|laoag|ilocos|la union|bataan|balanga|cabanatuan|marilao|baliwag|pulilan|san jose del monte|telabastagan|malolos|santiago|starmills|harbor point|marquee)/.test(
      t,
    )
  ) {
    return "north-luzon";
  }
  if (
    /(laguna|batangas|rizal|lucena|naga city|camarin|albay|sorsogon|\bdaet\b|lipa|calamba|santa rosa|sta\.? rosa|san pablo|angono|taytay|masinag|antipolo|san mateo|sto tomas|santo tomas|palawan|puerto princesa|legazpi|nuvali|binan|southwoods|galleria south)/.test(
      t,
    )
  ) {
    return "south-luzon";
  }
  // Capiz city only — not M.A. Roxas Highway on Luzon.
  if (
    /(iloilo|bacolod|roxas city|sm city roxas|place roxas|capiz|\bormoc\b|dumaguete|tacloban|pavia|antique|\bjaro\b)/.test(
      t,
    )
  ) {
    return "visayas";
  }
  throw new Error(`unmapped location: "${text}"`);
}
