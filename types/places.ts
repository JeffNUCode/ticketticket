/** Food, drink, and nearby entertainment places (non-cinema / non-ticketed). */

import type { CitySlug } from "@/types/database";

export type PlaceKind =
  | "restaurant"
  | "cafe"
  | "pub"
  | "bar"
  | "club"
  | "entertainment";

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  city: CitySlug;
  area: string;
  address: string;
  lat: number;
  lng: number;
  /** Official site, menu, or reservations when known. */
  website?: string;
  tags: string[];
}

export const PLACE_KIND_LABEL: Record<PlaceKind, string> = {
  restaurant: "Restaurants",
  cafe: "Cafés",
  pub: "Pubs",
  bar: "Bars",
  club: "Clubs",
  entertainment: "Entertainment",
};

export function mapsUrl(place: Place) {
  const q = encodeURIComponent(`${place.name} ${place.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function matchesPlace(place: Place, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [place.name, place.area, place.address, place.kind, ...place.tags]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}
