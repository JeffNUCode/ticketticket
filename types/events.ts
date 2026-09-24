/** Unified live-event inventory (non-cinema verticals). Cinema stays on showtimes.json. */

export type EventCategory =
  | "CINEMA"
  | "CONCERT"
  | "COMEDY_THEATER"
  | "EXPO_COMMUNITY"
  | "NIGHTLIFE_SOCIAL";

export type TicketStatus = "AVAILABLE" | "FEW_LEFT" | "SOLD_OUT" | "SELLING_SOON";

export interface Venue {
  id: string;
  name: string;
  chain_or_organizer?: string;
  city: string;
  address?: string;
  lat: number;
  lng: number;
}

export interface EventSchedule {
  start_time: string;
  end_time?: string;
  screen_or_hall?: string;
  price_range?: string;
  ticket_status: TicketStatus;
}

export interface GoSeeEvent {
  id: string;
  category: EventCategory;
  title: string;
  subtitle_or_performer?: string;
  tmdb_id?: number;
  poster_url: string;
  backdrop_url?: string;
  venue: Venue;
  tags: string[];
  booking_url: string;
  updated_at: string;
  schedules: EventSchedule[];
}

/** URL / UI tab keys (Movies stays on showtimes.json). */
export type EventTab = "movies" | "concerts" | "sports" | "comedy" | "expos";

export const EVENT_TAB_CATEGORIES: Record<Exclude<EventTab, "movies" | "sports">, EventCategory[]> = {
  concerts: ["CONCERT"],
  comedy: ["COMEDY_THEATER"],
  expos: ["EXPO_COMMUNITY", "NIGHTLIFE_SOCIAL"],
};

export function parseEventTab(raw: string | undefined): EventTab {
  if (raw === "concerts" || raw === "sports" || raw === "comedy" || raw === "expos") return raw;
  return "movies";
}

/** Concerts exclude sports-tagged SM listings; Sports is tag-driven. */
export function eventsForTab(events: GoSeeEvent[], tab: Exclude<EventTab, "movies">): GoSeeEvent[] {
  if (tab === "sports") return events.filter((e) => e.tags.includes("sports"));
  if (tab === "concerts") {
    return events.filter((e) => e.category === "CONCERT" && !e.tags.includes("sports"));
  }
  const allowed = EVENT_TAB_CATEGORIES[tab];
  return events.filter((e) => allowed.includes(e.category));
}

const EVENT_TABS = ["concerts", "sports", "comedy", "expos"] as const;

/** Counts per non-movie tab — hide empty buckets in the UI. */
export function eventTabCounts(events: GoSeeEvent[]): Record<(typeof EVENT_TABS)[number], number> {
  return {
    concerts: eventsForTab(events, "concerts").length,
    sports: eventsForTab(events, "sports").length,
    comedy: eventsForTab(events, "comedy").length,
    expos: eventsForTab(events, "expos").length,
  };
}

export function ticketStatusLabel(status: TicketStatus | undefined) {
  if (status === "FEW_LEFT") return "Few left";
  if (status === "SOLD_OUT") return "Sold out";
  if (status === "SELLING_SOON") return "Selling soon";
  return null;
}
