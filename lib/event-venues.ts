import venues from "@/seed/event-venues.json";
import type { Venue } from "@/types/events";

export type VenueSeed = {
  id: string;
  name: string;
  aliases: string[];
  city: string;
  address?: string;
  lat: number;
  lng: number;
  chain_or_organizer?: string;
};

const SEED = venues as VenueSeed[];

function norm(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toVenue(row: VenueSeed): Venue {
  return {
    id: row.id,
    name: row.name,
    chain_or_organizer: row.chain_or_organizer,
    city: row.city,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
  };
}

/** Map a scraped venue string to a seeded Venue, or null if nothing matches. */
export function resolveVenue(rawName: string): Venue | null {
  const q = norm(rawName);
  if (!q) return null;

  // Exact name / alias first
  for (const row of SEED) {
    const names = [row.name, ...row.aliases].map(norm);
    if (names.some((n) => n === q)) return toVenue(row);
  }

  // Prefer the longest substring hit so "SMX Bacolod" beats bare "SMX"
  let best: { row: VenueSeed; len: number } | null = null;
  for (const row of SEED) {
    for (const n of [row.name, ...row.aliases].map(norm)) {
      if (!n) continue;
      if (q.includes(n) || n.includes(q)) {
        if (!best || n.length > best.len) best = { row, len: n.length };
      }
    }
  }
  return best ? toVenue(best.row) : null;
}

/** Unresolved venue — Manila centroid so distance sort still works. */
export function fallbackVenue(rawName: string): Venue {
  const base = SEED.find((v) => v.id === "v-manila-centroid")!;
  const slug = norm(rawName).replace(/\s+/g, "-").slice(0, 40) || "unknown";
  return {
    id: `v-unknown-${slug}`,
    name: rawName.trim() || "Venue TBA",
    city: base.city,
    lat: base.lat,
    lng: base.lng,
  };
}

export function resolveOrFallback(rawName: string): Venue {
  return resolveVenue(rawName) ?? fallbackVenue(rawName);
}
