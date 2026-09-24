/**
 * Captures SM Tickets listings into data/events.json via getEventsDate (+ title enrich).
 *   npx tsx scripts/capture-sm-tickets.ts
 */
import "./env";
import { launchBrowser, UA } from "./browser";
import { resolveOrFallback } from "../lib/event-venues";
import { mergeEventsAndWrite, smDateToIso } from "../lib/events-inventory";
import type { GoSeeEvent, TicketStatus } from "@/types/events";

const BASE = "https://smtickets.com";
const SOURCE = "evt-smt-";

type SmDateRow = {
  event_active?: string;
  event_id: string;
  event_title?: string;
  event_long_title: string;
  event_date_time: string;
  event_venue_name?: string;
  event_image?: string;
};

function isSports(title: string, venue: string) {
  return /\b(uaap|ncaa|nba|pba|pvl|mpbl|wnba|fiba|basketball|volleyball|pickleball|football|soccer|boxing|tennis|golf|badminton|softball|baseball|hockey|esports|shakey'?s|league|unity cup|yakult|10-miler|marathon|triathlon|\brun\b|\bcup\b)\b/i.test(
    `${title} ${venue}`,
  );
}

function statusOf(active: string | undefined): TicketStatus {
  return active === "0" ? "SOLD_OUT" : "AVAILABLE";
}

function toEvent(row: SmDateRow, page: "music" | "sports"): GoSeeEvent | null {
  const title = (row.event_long_title || row.event_title || "").trim();
  if (!title || !row.event_id) return null;
  const start = smDateToIso(row.event_date_time);
  if (!start) return null;

  const venueName = (row.event_venue_name || "").trim() || "Venue TBA";
  const venue = resolveOrFallback(venueName);
  const sports = isSports(title, venueName) || page === "sports";

  return {
    id: `${SOURCE}${row.event_id}`,
    category: "CONCERT",
    title,
    poster_url: row.event_image || "",
    venue,
    tags: ["sm-tickets", sports ? "sports" : "music"],
    booking_url: `${BASE}/events/${row.event_id}`,
    updated_at: new Date().toISOString(),
    schedules: [
      {
        start_time: start,
        ticket_status: statusOf(row.event_active),
      },
    ],
  };
}

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const byId = new Map<string, GoSeeEvent>();

  try {
    await page.goto(`${BASE}/events/category/music`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2000);

    const rows = (await page.request.get(`${BASE}/events/getEventsDate`).then((r) => r.json())) as SmDateRow[];
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("getEventsDate returned no rows");
    console.log(`${rows.length} SM Tickets active event(s)`);

    for (const row of rows) {
      if (row.event_active === "0") continue;
      const sports = isSports(row.event_long_title || "", row.event_venue_name || "");
      const evt = toEvent(row, sports ? "sports" : "music");
      if (!evt) continue;
      const prev = byId.get(evt.id);
      if (!prev || (evt.poster_url && !prev.poster_url)) byId.set(evt.id, evt);
    }

    const titles = (await page.request.get(`${BASE}/events/getEventsTitle`).then((r) => r.json())) as {
      event_id: string;
      event_long_title: string;
    }[];
    let enriched = 0;
    for (const t of titles.slice(0, 80)) {
      if (byId.has(`${SOURCE}${t.event_id}`)) continue;
      try {
        const detail = (await page.request
          .get(`${BASE}/events/getEventsByTitle?event_long_title=${encodeURIComponent(t.event_long_title)}`)
          .then((r) => r.json())) as { event_id: string; event_long_title: string; event_date_time: string }[];
        const d = detail?.[0];
        if (!d?.event_date_time) continue;
        const evt = toEvent(
          {
            event_id: d.event_id || t.event_id,
            event_long_title: d.event_long_title || t.event_long_title,
            event_date_time: d.event_date_time,
            event_active: "1",
          },
          isSports(t.event_long_title, "") ? "sports" : "music",
        );
        if (evt) {
          byId.set(evt.id, evt);
          enriched++;
        }
      } catch {
        /* skip */
      }
    }
    if (enriched) console.log(`enriched ${enriched} from getEventsByTitle`);
  } finally {
    await browser.close();
  }

  const list = [...byId.values()];
  if (list.length === 0) throw new Error("captured 0 SM Tickets events");

  const total = await mergeEventsAndWrite(list, SOURCE);
  console.log(`wrote ${list.length} SM Tickets event(s); data/events.json now holds ${total}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
