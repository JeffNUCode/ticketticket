/** Home Discover: 3 hubs (Movies / Live / Nearby), fine tabs underneath. */

import { eventTabCounts, type EventTab, type GoSeeEvent } from "@/types/events";
import { PLACE_KIND_LABEL, type Place, type PlaceKind } from "@/types/places";

export type DiscoverTab = EventTab | PlaceKind;
export type DiscoverHub = "movies" | "live" | "nearby";

export const PLACE_TABS: PlaceKind[] = [
  "restaurant",
  "cafe",
  "pub",
  "bar",
  "club",
  "entertainment",
];

export const EVENT_DISCOVER_TABS: Exclude<EventTab, "movies">[] = [
  "concerts",
  "sports",
  "comedy",
  "expos",
];

export const DISCOVER_HUBS: { id: DiscoverHub; label: string }[] = [
  { id: "movies", label: "Movies" },
  { id: "live", label: "Live" },
  { id: "nearby", label: "Nearby" },
];

export function isPlaceTab(tab: DiscoverTab): tab is PlaceKind {
  return (PLACE_TABS as string[]).includes(tab);
}

export function isEventTab(tab: DiscoverTab): tab is Exclude<EventTab, "movies"> {
  return (EVENT_DISCOVER_TABS as string[]).includes(tab);
}

export function discoverHub(tab: DiscoverTab): DiscoverHub {
  if (isPlaceTab(tab)) return "nearby";
  if (isEventTab(tab)) return "live";
  return "movies";
}

export function parseDiscoverTab(raw: string | undefined): DiscoverTab {
  if (!raw || raw === "movies") return "movies";
  if (raw === "live") return "concerts";
  if (raw === "nearby") return "restaurant";
  if ((PLACE_TABS as string[]).includes(raw)) return raw as PlaceKind;
  if (raw === "concerts" || raw === "sports" || raw === "comedy" || raw === "expos") return raw;
  return "movies";
}

/** First inventory-backed tab for a hub (fallback when counts empty). */
export function defaultTabForHub(hub: DiscoverHub, counts?: DiscoverCounts): DiscoverTab {
  if (hub === "movies") return "movies";
  if (hub === "live") {
    const hit = EVENT_DISCOVER_TABS.find((id) => (counts?.[id] ?? 0) > 0);
    return hit ?? "concerts";
  }
  const hit = PLACE_TABS.find((id) => (counts?.[id] ?? 0) > 0);
  return hit ?? "restaurant";
}

export function discoverTabLabel(tab: DiscoverTab): string {
  if (tab === "movies") return "Movies";
  if (isPlaceTab(tab)) return PLACE_KIND_LABEL[tab];
  if (tab === "concerts") return "Concerts";
  if (tab === "sports") return "Sports";
  if (tab === "comedy") return "Comedy & Theater";
  return "Expos & Pop-ups";
}

export function placesForTab(places: Place[], tab: PlaceKind): Place[] {
  return places.filter((p) => p.kind === tab);
}

export function placeTabCounts(places: Place[]): Record<PlaceKind, number> {
  return {
    restaurant: placesForTab(places, "restaurant").length,
    cafe: placesForTab(places, "cafe").length,
    pub: placesForTab(places, "pub").length,
    bar: placesForTab(places, "bar").length,
    club: placesForTab(places, "club").length,
    entertainment: placesForTab(places, "entertainment").length,
  };
}

export type DiscoverCounts = Partial<Record<Exclude<DiscoverTab, "movies">, number>>;

export function discoverTabCounts(events: GoSeeEvent[], places: Place[]): DiscoverCounts {
  return { ...eventTabCounts(events), ...placeTabCounts(places) };
}

/** @deprecated Prefer DISCOVER_HUBS + sub-tabs. Kept for any leftover callers. */
export const DISCOVER_TAB_ORDER: { id: DiscoverTab; label: string }[] = [
  { id: "movies", label: "Movies" },
  { id: "concerts", label: "Concerts" },
  { id: "sports", label: "Sports" },
  { id: "comedy", label: "Comedy & Theater" },
  { id: "expos", label: "Expos & Pop-ups" },
  ...PLACE_TABS.map((id) => ({ id, label: PLACE_KIND_LABEL[id] })),
];
