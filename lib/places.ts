import places from "@/seed/places.json";
import type { Place, PlaceKind } from "@/types/places";

export function loadPlaces(): Place[] {
  return places as Place[];
}

export function placeKindsIn(list: Place[]): PlaceKind[] {
  return [...new Set(list.map((p) => p.kind))];
}
