import assert from "assert";
import { cityOffset, matchesCinema, parseSchedule, toIso } from "../lib/ingest";
import { applyLocalTitles, missingMovieIds } from "../lib/inventory";
import { assignArea, parseCity, hasChosenCity } from "../lib/cities";
import { assignSmCity, smCinemaId, smSiteSlug } from "../lib/sm";
import { AYALA_SITE_IDS, ayalaSiteIdOf } from "../lib/ayala";
import { isFilmProduct, megaStartIso, parseMegaCategory, parseMegaProduct } from "../lib/mega";
import { dotNetToPhIso, matchRobBranch, parseRobJson, parseRobSchedules, resolveRobCinemaId, robScheduleDate } from "../lib/rob";
import { parseVistaSchedules, resolveVistaCinemaId, vistaScreenType } from "../lib/vista";
import { fisherDateToIso, fisherScreenType, fisherStartIso } from "../lib/fisher";
import { PP_CINEMA_IDS, ppShowtimeIso, ppScreenType } from "../lib/powerplant";
import { resolveVenue } from "../lib/event-venues";
import { smDateToIso } from "../lib/events-inventory";
import { SEED } from "../lib/seed";
import partnerCinemas from "../data/partner-cinemas.json";
import { groupByMall, nextPerMovie, nowShowing, upcoming } from "../lib/group";
import { DATE_HORIZON, horizonDates } from "../lib/utils";
import type { MovieRow, ShowtimeRow } from "../types/database";

const schedule = parseSchedule(`
# comment
cinema: c-sm-mega
date: 2026-09-10

Wicked: For Good | IMAX | ₱1,020
11:00 AM, 1:40 PM
7 pm

Zootopia 2
10:30, 22:15
`);

assert.equal(schedule.cinemaId, "c-sm-mega");
assert.equal(schedule.date, "2026-09-10");
assert.equal(schedule.entries.length, 2);

const [first, second] = schedule.entries;
assert.equal(first.screenType, "IMAX");
assert.equal(first.price, 1020);
assert.deepEqual(first.times, ["11:00 AM", "1:40 PM", "7 pm"]);
assert.equal(second.screenType, "2D", "format defaults to 2D");
assert.equal(second.price, null);

// Page furniture from a raw copy-paste is dropped, but reported so a mis-skip is visible.
const pasted = parseSchedule(`
cinema: c-sm-mega
date: 2026-09-10

Cinema 5
Wicked: For Good
PG-13
2h 45m
₱350.00
11:00 AM
Buy Tickets

Book Club
1:40 PM
`);
assert.deepEqual(
  pasted.skipped,
  ["Cinema 5", "PG-13", "2h 45m", "₱350.00", "Buy Tickets"],
  "furniture skipped and reported",
);
assert.deepEqual(
  pasted.entries.map((e) => e.title),
  ["Wicked: For Good", "Book Club"],
  "a title that looks like a UI label is still a title",
);
assert.deepEqual(pasted.entries[0].times, ["11:00 AM"]);

const ph = cityOffset("metro-manila");
assert.equal(toIso("2026-09-10", "11:00 AM", ph), "2026-09-10T11:00:00+08:00");
assert.equal(toIso("2026-09-10", "1:40 PM", ph), "2026-09-10T13:40:00+08:00");
assert.equal(toIso("2026-09-10", "7 pm", ph), "2026-09-10T19:00:00+08:00");
assert.equal(toIso("2026-09-10", "12:15 AM", ph), "2026-09-10T00:15:00+08:00");
assert.equal(toIso("2026-09-10", "12:15 PM", ph), "2026-09-10T12:15:00+08:00");
assert.equal(toIso("2026-09-10", "22:15", ph), "2026-09-10T22:15:00+08:00");
assert.equal(cityOffset("metro-manila"), "+08:00");
assert.equal(cityOffset("cebu"), "+08:00");

// Bad input must fail loudly rather than land wrong times in the DB.
assert.throws(() => toIso("2026-09-10", "25:00", ph), /bad time/);
assert.throws(() => toIso("2026-09-10", "noon", ph), /bad time/);
assert.throws(() => toIso("2026-09-10", "13:40 PM", ph), /bad time/);
assert.throws(() => parseSchedule("date: 2026-09-10\nFoo | 2D\n1:00 PM"), /cinema/);
assert.throws(() => parseSchedule("cinema: c-sm-mega\nFoo | 2D\n1:00 PM"), /date/);
assert.throws(() => parseSchedule("cinema: c\ndate: 2026-09-10\n1:00 PM"), /before any movie/);
assert.throws(
  () => parseSchedule("cinema: c\ndate: 2026-09-10\nFoo | 4DX\n1:00 PM"),
  /unknown format/,
);
assert.throws(() => parseSchedule("cinema: c\ndate: 2026-09-10\nFoo | 2D"), /no showtimes/);

// Re-runs and local classics have showtimes but sit outside TMDB's now-playing window;
// they must be reported as missing so the catalog hydrates them instead of dropping the rows.
const rows = [
  { movie_id: "tmdb-969681" },
  { movie_id: "tmdb-197976" },
  { movie_id: "tmdb-197976" },
] as ShowtimeRow[];
assert.deepEqual(missingMovieIds(rows, [{ id: "tmdb-969681" }]), ["tmdb-197976"]);
assert.deepEqual(missingMovieIds(rows, [{ id: "tmdb-969681" }, { id: "tmdb-197976" }]), []);

// The billed title wins over TMDB's English export title, and the slug follows it.
const tmdbRows = [
  { id: "tmdb-197976", title: "Miracle", slug: "miracle-197976" },
  { id: "tmdb-969681", title: "Spider-Man: Brand New Day", slug: "spider-man-brand-new-day-969681" },
] as MovieRow[];
const retitled = applyLocalTitles(tmdbRows, new Map([["tmdb-197976", "Himala"]]));
assert.equal(retitled[0].title, "Himala");
assert.equal(retitled[0].slug, "himala-197976");
assert.equal(retitled[1], tmdbRows[1], "untouched movies keep their identity");
assert.equal(applyLocalTitles(tmdbRows, new Map())[0].title, "Miracle");

const horizonRows = [
  { cinema: { city: "cavite" }, start_time: "2026-09-08T20:00:00+08:00" },
  { cinema: { city: "cavite" }, start_time: "2026-09-10T11:00:00+08:00" },
  { cinema: { city: "cavite" }, start_time: "2026-09-16T13:00:00+08:00" },
  { cinema: { city: "cebu" }, start_time: "2026-09-20T13:00:00+08:00" },
];
assert.deepEqual(horizonDates(horizonRows, "cavite", "2026-09-09"), ["2026-09-10", "2026-09-16"]);
assert.deepEqual(horizonDates(horizonRows, "metro-manila", "2026-09-09"), ["2026-09-09"]);
assert.equal(DATE_HORIZON, 30);

assert.equal(assignSmCity("SM City Dasmarinas, Governors Drive, Cavite"), "cavite");
assert.equal(assignSmCity("SM City Cagayan de Oro, Misamis Oriental"), "mindanao");
assert.equal(assignSmCity("SM City Tuguegarao, Cagayan"), "north-luzon");
assert.equal(assignSmCity("SM City Iloilo, Mandurriao"), "visayas");
assert.equal(assignSmCity("SM Megamall, Mandaluyong City"), "metro-manila");
assert.equal(assignArea("Ayala Malls Vermosa, Imus, Cavite"), "cavite");
assert.equal(assignArea("Robinsons Galleria Cebu, Cebu City"), "cebu");
assert.equal(assignArea("Robinsons Iloilo, Iloilo City"), "visayas");
assert.equal(assignArea("Eastwood Mall, Quezon City"), "metro-manila");
assert.equal(
  assignArea("SM City Clark Cinema, M.A. Roxas Highway, Malabanias Angeles City"),
  "north-luzon",
);
assert.equal(assignArea("SM City Roxas, Roxas City, Capiz"), "visayas");
assert.equal(assignArea("Robinsons Place Roxas"), "visayas");

{
  const ids = partnerCinemas.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "partner cinema ids must be unique");
  for (const needed of ["c-ayala-gc", "c-rob-galleria", "c-mega-u"]) {
    assert.ok(ids.includes(needed), needed);
  }
  for (const needed of ["c-ayala-gc", "c-ayala-bgc", "c-ayala-cebu", "c-ayala-legazpi", "c-rob-galleria", "c-mega-u"]) {
    assert.ok(SEED.cinemas.some((c) => c.id === needed), `seed still references ${needed}`);
  }
  const chains = new Set(SEED.cinemas.map((c) => c.chain));
  assert.ok(
    chains.has("Ayala Malls") &&
      chains.has("Robinsons") &&
      chains.has("Megaworld") &&
      chains.has("Vista Cinemas") &&
      chains.has("Gateway Cineplex") &&
      chains.has("Power Plant") &&
      chains.has("Fisher Mall"),
  );
  assert.ok(SEED.cinemas.some((c) => c.id === "c-vista-evia"), "seed has Vista Evia");
  assert.ok(SEED.cinemas.some((c) => c.id === "c-gateway-18"), "seed has Gateway");
  assert.ok(SEED.cinemas.some((c) => c.id === "c-pp-makati"), "seed has Power Plant");
  assert.ok(SEED.cinemas.some((c) => c.id === "c-fisher-quezon"), "seed has Fisher");
}
assert.equal(smCinemaId("2402"), "c-sm-dasma");
assert.equal(smCinemaId("2002"), "c-sm-2002");
assert.equal(smSiteSlug("SM City Dasmariñas"), "SM-City-Dasmarinas");
assert.equal(
  matchesCinema(
    { mall: "SM City Dasmariñas", name: "SM Dasmariñas", address: "Governors Drive, Cavite", chain: "SM Cinema" },
    "dasma",
  ),
  true,
);
assert.equal(
  matchesCinema(
    { mall: "SM Megamall", name: "SM Megamall", address: "Mandaluyong", chain: "SM Cinema" },
    "dasma",
  ),
  false,
);

// A screening that already started is not bookable, and the soonest one must come first.
const now = new Date("2026-09-10T19:00:00+08:00").getTime();
const shows = [
  { id: "late", start_time: "2026-09-10T22:00:00+08:00" },
  { id: "past", start_time: "2026-09-10T10:30:00+08:00" },
  { id: "soon", start_time: "2026-09-10T19:00:00+08:00" },
];
assert.deepEqual(
  upcoming(shows, now).map((s) => s.id),
  ["soon", "late"],
);
assert.equal(parseCity(undefined), "metro-manila");
assert.equal(parseCity(undefined, "cavite"), "south-luzon");
assert.equal(parseCity("cebu", "cavite"), "visayas");
assert.equal(parseCity("not-a-city", "davao"), "mindanao");
assert.equal(parseCity("all"), "all");
assert.equal(hasChosenCity(undefined, undefined), false);
assert.equal(hasChosenCity("cavite", undefined), true);
assert.equal(hasChosenCity("all", undefined), true);

const malls = groupByMall(
  [
    {
      id: "far",
      movie_id: "m",
      cinema_id: "far",
      screen_type: "2D",
      start_time: "2026-09-10T20:00:00+08:00",
      price: 0,
      booking_direct_url: "",
      updated_at: "",
      movie: { id: "m" } as never,
      cinema: {
        id: "far",
        mall: "AAA Far",
        latitude: 14.6,
        longitude: 121.0,
      } as never,
    },
    {
      id: "near",
      movie_id: "m",
      cinema_id: "near",
      screen_type: "2D",
      start_time: "2026-09-10T20:00:00+08:00",
      price: 0,
      booking_direct_url: "",
      updated_at: "",
      movie: { id: "m" } as never,
      cinema: {
        id: "near",
        mall: "ZZZ Near",
        latitude: 14.33,
        longitude: 120.94,
      } as never,
    },
  ],
  { lat: 14.3294, lng: 120.9367 },
);
assert.equal(malls[0].cinema.id, "near");

// Rail lists each film once, the most-screened one first.
const rail = nowShowing(
  ["a", "b", "a", "c", "a", "b"].map((id, i) => ({
    id: `s${i}`,
    movie: { id, title: id.toUpperCase() },
  })) as never,
);
assert.deepEqual(
  rail.map((m) => m.id),
  ["a", "b", "c"],
);

// Saved shows the soonest screening per film, even when inventory is out of order.
const later = "2999-01-02T20:00:00+08:00";
const sooner = "2999-01-01T13:00:00+08:00";
assert.equal(nextPerMovie([
  { movie_id: "a", start_time: later, booking_direct_url: "https://x", screen_type: "2D", price: null, cinema: { mall: "Late Mall", name: "Late", chain: "X" } },
  { movie_id: "a", start_time: sooner, booking_direct_url: "https://y", screen_type: "2D", price: null, cinema: { mall: "Early Mall", name: "Early", chain: "Y" } },
] as never).a.mall, "Early Mall");
assert.equal(nextPerMovie([
  { movie_id: "a", start_time: later, booking_direct_url: "https://x", screen_type: "2D", price: null, cinema: { mall: "Late Mall", name: "Late", chain: "X" } },
  { movie_id: "a", start_time: sooner, booking_direct_url: "https://y", screen_type: "2D", price: null, cinema: { mall: "Early Mall", name: "Early", chain: "Y" } },
] as never).a.start_time, sooner);

assert.equal(megaStartIso("2026-09-15", "17:45"), "2026-09-15T17:45:00+08:00");
assert.equal(megaStartIso("2026-09-15", "9:05"), "2026-09-15T09:05:00+08:00");
assert.equal(isFilmProduct("cahim-eastwood-cinema-6", "eastwood"), true);
assert.equal(isFilmProduct("food-bundle-190", "eastwood"), false);
assert.equal(isFilmProduct("venice-cineplex", "newport"), false);

const megaCat = parseMegaCategory(
  `"slug":"always-yours-never-mine-eastwood-cinema-5","title":"ALWAYS YOURS, NEVER MINE","storefront_card_description":"CINEMA 5","price":470` +
    `"slug":"food-bundle-190","title":"Snack","price":190`,
  "eastwood",
);
assert.equal(megaCat.length, 1);
assert.equal(megaCat[0].title, "ALWAYS YOURS, NEVER MINE");
assert.equal(megaCat[0].screen, "2D");

const megaProd = parseMegaProduct(
  `"slug":"cahim-eastwood-cinema-6","title":"CAHIM","storefront_card_description":"CINEMA 6"` +
    `"code":"date","values":[{"name":"Sep 15, 2026","value":"2026-09-15"}]` +
    `"code":"timeslot","values":[{"name":"05:45 PM - 07:05 PM","value":"17:45-19:05"}]`,
  "cahim-eastwood-cinema-6",
);
assert.deepEqual(megaProd.dates, ["2026-09-15"]);
assert.deepEqual(megaProd.times, ["17:45"]);
assert.equal(megaProd.title, "CAHIM");

const robSched = parseRobSchedules(
  JSON.stringify([
    {
      Cinema_Name: "CINEMA 3",
      MCT_Key: 1,
      Screening_Type: "2D",
      Price: 250,
      Start_Time: "/Date(1789444500000)/",
    },
  ]),
);
assert.equal(robSched.length, 1);
assert.equal(robSched[0].cinemaName, "CINEMA 3");
assert.equal(robScheduleDate("/Date(1789401600000)/"), "09-15-2026");
assert.deepEqual(parseRobJson('{"ok":true}'), { ok: true });
assert.deepEqual(parseRobJson('"{\\"ok\\":true}"'), { ok: true });
assert.match(dotNetToPhIso("/Date(1789444500000)/") ?? "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
assert.equal(matchRobBranch("DASMARINAS", "Robinsons Dasmariñas", "Robinsons Dasmariñas"), true);
assert.equal(matchRobBranch("GALLERIA ORTIGAS", "Robinsons Galleria Ortigas", "Robinsons Galleria Ortigas"), true);
assert.equal(matchRobBranch("GALLERIA CEBU", "Robinsons Galleria Ortigas", "Robinsons Galleria Ortigas"), false);
assert.equal(
  resolveRobCinemaId("GALLERIA CEBU", [
    { id: "c-rob-galleria", mall: "Robinsons Galleria Ortigas", name: "Robinsons Galleria Ortigas" },
    { id: "c-rob-galleria-cebu", mall: "Robinsons Galleria Cebu", name: "Robinsons Galleria Cebu" },
  ]),
  "c-rob-galleria-cebu",
);
assert.equal(
  resolveRobCinemaId("NORTH TACLOBAN", [
    { id: "c-rob-tacloban", mall: "Robinsons Tacloban", name: "Robinsons Tacloban" },
    { id: "c-rob-north-tacloban", mall: "Robinsons North Tacloban", name: "Robinsons North Tacloban" },
  ]),
  "c-rob-north-tacloban",
);
assert.equal(AYALA_SITE_IDS["1003"], "c-ayala-gc");
assert.equal(ayalaSiteIdOf("https://www.ayalaallaccess.com/sites/Greenbelt/1003"), "1003");
assert.equal(ayalaSiteIdOf("https://www.ayalaallaccess.com/"), null);

{
  assert.equal(vistaScreenType("VIP 2D"), "Director's Club");
  assert.equal(vistaScreenType("2D"), "2D");
  assert.equal(
    resolveVistaCinemaId(
      { Branch_Key: 1, Branch_Name: "Vista Cinemas at Evia Lifestyle Center" },
      [{ id: "c-vista-evia", mall: "Evia Lifestyle Center", name: "Vista Cinemas Evia" }],
    ),
    "c-vista-evia",
  );
  const slots = parseVistaSchedules(
    [
      {
        // Far-future screening so the days window never expires this assert.
        ScreeningDate: "/Date(1792080000000)/",
        Cinemas: [
          {
            Name: "Cinema 8",
            FilmFormat: "VIP 2D",
            Schedules: [{ MCTKey: 1, Start: "/Date(1792112400000)/", Price: 905 }],
          },
        ],
      },
    ],
    400,
  );
  assert.equal(slots.length, 1);
  assert.equal(slots[0].price, 905);
}

assert.equal(fisherDateToIso("September 23, 2026"), "2026-09-23");
assert.equal(fisherStartIso("September 23, 2026", "1:40 PM"), "2026-09-23T13:40:00+08:00");
assert.equal(fisherScreenType("PREMIERE VIP"), "Director's Club");
assert.equal(PP_CINEMA_IDS["0001"], "c-pp-makati");
assert.equal(ppShowtimeIso("2026-09-23T13:00:00"), "2026-09-23T13:00:00+08:00");
assert.equal(ppScreenType("C7", ["Cinema 7"]), "2D");
assert.equal(smDateToIso("2026-10-10 18:00:00"), "2026-10-10T18:00:00+08:00");
assert.equal(resolveVenue("SM Mall of Asia Arena")?.id, "v-moa-arena");
assert.equal(resolveVenue("Smart Araneta Coliseum")?.id, "v-araneta");

console.log("ok ingest parser");
