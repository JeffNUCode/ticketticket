/**
 * Captures Eventbrite PH city listings into data/events.json for
 * Comedy & Theater + Expos & Pop-ups tabs.
 *
 *   npx tsx scripts/capture-eventbrite.ts
 */
import "./env";
import type { Page } from "playwright-core";
import { launchBrowser, UA } from "./browser";
import { resolveOrFallback } from "../lib/event-venues";
import { mergeEventsAndWrite } from "../lib/events-inventory";
import type { EventCategory, GoSeeEvent, TicketStatus } from "@/types/events";

const SOURCE = "evt-eb-";

/** Major PH destinations (Eventbrite place slugs). */
const PLACES: { slug: string; fallbackVenue: string; full: boolean }[] = [
  { slug: "philippines--manila", fallbackVenue: "Metro Manila", full: true },
  { slug: "philippines--quezon-city", fallbackVenue: "Metro Manila", full: false },
  { slug: "philippines--makati", fallbackVenue: "Metro Manila", full: false },
  { slug: "philippines--taguig", fallbackVenue: "Metro Manila", full: false },
  { slug: "philippines--pasay", fallbackVenue: "Metro Manila", full: false },
  { slug: "philippines--cebu-city", fallbackVenue: "Cebu", full: true },
  { slug: "philippines--davao-city", fallbackVenue: "Davao", full: true },
  { slug: "philippines--iloilo-city", fallbackVenue: "Iloilo", full: false },
  { slug: "philippines--bacolod", fallbackVenue: "Bacolod", full: false },
];

const CATEGORIES_FULL: { path: string; prefer: EventCategory }[] = [
  { path: "performing-arts--events/", prefer: "COMEDY_THEATER" },
  { path: "food-and-drink--events/", prefer: "EXPO_COMMUNITY" },
  { path: "hobbies--events/", prefer: "EXPO_COMMUNITY" },
  { path: "community--events/", prefer: "NIGHTLIFE_SOCIAL" },
  { path: "music--events/", prefer: "CONCERT" },
];

/** Slimmer set for secondary cities — keeps PH coverage without 45 browse hits. */
const CATEGORIES_SLIM = CATEGORIES_FULL.filter((c) =>
  /performing-arts|food-and-drink|community/.test(c.path),
);

type Browse = { path: string; prefer: EventCategory; fallbackVenue: string };
const BROWSE: Browse[] = PLACES.flatMap((place) =>
  (place.full ? CATEGORIES_FULL : CATEGORIES_SLIM).map((cat) => ({
    path: `d/${place.slug}/${cat.path}`,
    prefer: cat.prefer,
    fallbackVenue: place.fallbackVenue,
  })),
);

type EbTag = { prefix?: string; tag?: string; display_name?: string };
type EbEvent = {
  id: string;
  name: string;
  url: string;
  summary?: string;
  start_date?: string;
  start_time?: string;
  end_date?: string;
  end_time?: string;
  timezone?: string;
  status?: string;
  is_online_event?: boolean;
  is_cancelled?: boolean | null;
  tags?: EbTag[];
  image?: { url?: string };
};

function categoryOf(ev: EbEvent, prefer: EventCategory): EventCategory {
  const names = (ev.tags ?? []).map((t) => t.display_name || "").join(" ").toLowerCase();
  const title = `${ev.name} ${ev.summary || ""}`.toLowerCase();
  const blob = `${names} ${title}`;

  if (/comedy|stand-?up|improv|theatre|theater|musical|ballet|opera|performing arts|film|screening|art show|gallery/i.test(blob)) {
    return "COMEDY_THEATER";
  }
  if (/nightlife|party|club|happy hour|meetup|social/i.test(blob)) return "NIGHTLIFE_SOCIAL";
  if (/food|drink|expo|con\b|convention|workshop|fair|market|hobby|community|tradeshow|festival/i.test(blob)) {
    return "EXPO_COMMUNITY";
  }
  if (/music|concert|dj|rnb/i.test(blob) && prefer !== "COMEDY_THEATER") return "CONCERT";
  // Trust the browse page when Eventbrite's own tags are vague.
  return prefer;
}

function keepEvent(ev: EbEvent, category: EventCategory) {
  if (ev.is_cancelled || ev.status === "canceled" || ev.status === "cancelled") return false;
  if (ev.is_online_event) return false;
  const title = `${ev.name} ${ev.summary || ""}`.toLowerCase();
  if (/forex|servsafe|cfpm|virtual\b|zoom\b|webinar/.test(title)) return false;
  if (
    category === "COMEDY_THEATER" &&
    /conference|summit|finance|forex|sales skills|canva|data visualization|consultative selling|girl guides|mental health|somatic healing|feedback loop/.test(
      title,
    )
  ) {
    return false;
  }
  return true;
}

function toIso(date?: string, time?: string) {
  if (!date) return null;
  const t = (time || "00:00").length === 5 ? `${time}:00` : time || "00:00:00";
  return `${date}T${t}+08:00`;
}

function venueFromSummary(ev: EbEvent, fallbackVenue: string) {
  const m = /\bat\s+([^.,\n]{4,60})/i.exec(ev.summary || "");
  return resolveOrFallback(m?.[1]?.trim() || fallbackVenue);
}

function statusOf(ev: EbEvent): TicketStatus {
  if (ev.status === "sold_out") return "SOLD_OUT";
  if (ev.status === "started") return "FEW_LEFT";
  return "AVAILABLE";
}

function toGoSee(ev: EbEvent, prefer: EventCategory, fallbackVenue: string): GoSeeEvent | null {
  const category = categoryOf(ev, prefer);
  if (!keepEvent(ev, category)) return null;
  const start = toIso(ev.start_date, ev.start_time);
  if (!start) return null;
  const end = toIso(ev.end_date, ev.end_time) ?? undefined;

  return {
    id: `${SOURCE}${ev.id}`,
    category,
    title: ev.name.trim(),
    poster_url: ev.image?.url || "",
    venue: venueFromSummary(ev, fallbackVenue),
    tags: ["eventbrite", category.toLowerCase()],
    booking_url: ev.url.split("?")[0],
    updated_at: new Date().toISOString(),
    schedules: [
      {
        start_time: start,
        end_time: end,
        ticket_status: statusOf(ev),
      },
    ],
  };
}

async function collectIds(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2500);
  return page.evaluate(() =>
    [...new Set(
      [...document.querySelectorAll("a[href*='/e/']")]
        .map((a) => /tickets-(\d+)/.exec((a as HTMLAnchorElement).href)?.[1])
        .filter(Boolean) as string[],
    )],
  );
}

async function fetchEvents(page: Page, ids: string[]) {
  if (ids.length === 0) return [] as EbEvent[];
  const chunk: EbEvent[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const slice = ids.slice(i, i + 40);
    const res = await page.request.get(
      `https://www.eventbrite.com/api/v3/destination/events/?event_ids=${slice.join(",")}`,
    );
    if (!res.ok()) continue;
    const data = (await res.json()) as { events?: EbEvent[] };
    chunk.push(...(data.events ?? []));
  }
  return chunk;
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const byId = new Map<string, GoSeeEvent>();

  try {
    for (const browse of BROWSE) {
      const url = `https://www.eventbrite.com/${browse.path}`;
      console.log(`\n${url}`);
      let ids: string[] = [];
      try {
        ids = await collectIds(page, url);
      } catch (e) {
        console.warn("browse failed", e instanceof Error ? e.message : e);
        continue;
      }
      console.log(`  ${ids.length} id(s)`);
      const raw = await fetchEvents(page, ids);
      for (const ev of raw) {
        const item = toGoSee(ev, browse.prefer, browse.fallbackVenue);
        if (!item) continue;
        // Prefer comedy/expo over concert if the same event appears in multiple browses.
        const prev = byId.get(item.id);
        if (!prev || rank(item.category) >= rank(prev.category)) byId.set(item.id, item);
      }
    }
  } finally {
    await browser.close();
  }

  const list = [...byId.values()];
  if (list.length === 0) throw new Error("captured 0 Eventbrite events");

  const total = await mergeEventsAndWrite(list, SOURCE);
  const comedy = list.filter((e) => e.category === "COMEDY_THEATER").length;
  const expo = list.filter((e) => e.category === "EXPO_COMMUNITY" || e.category === "NIGHTLIFE_SOCIAL").length;
  console.log(`\nwrote ${list.length} Eventbrite event(s) (comedy/theater ${comedy}, expos/nightlife ${expo})`);
  console.log(`data/events.json now holds ${total}`);
}

function rank(c: EventCategory) {
  if (c === "COMEDY_THEATER") return 3;
  if (c === "EXPO_COMMUNITY" || c === "NIGHTLIFE_SOCIAL") return 2;
  return 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
