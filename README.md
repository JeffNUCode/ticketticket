# GoSee!

Movie discovery + showtime aggregator. Next.js App Router, Tailwind, Supabase schema.

## Run

```bash
npm install
npm run dev
```

## True data (two layers)

Cinema **titles** and cinema **times** are different products.

| Layer | What it is | Source we use |
|---|---|---|
| Catalog | What’s in PH theaters this week, posters, synopsis | [TMDB](https://www.themoviedb.org/settings/api) `now_playing?region=PH` |
| Inventory | This mall, this screen, this clock time, bookable URL | Partner feed, operator JSON, or your DB — **not** TMDB |

There is no public SM / SureSeats / Robinsons showtime API. Vista (SM’s booking UI) and GMovies/SureSeats sell to exhibitors, not aggregators. Scraping those sites is brittle and usually against ToS — we do not do it in this repo.

**Until inventory exists, we link out to official bookers.** We do not invent times.

### TMDB (catalog)

1. Create an API key at themoviedb.org.
2. Put `TMDB_API_KEY=` in `.env.local`.
3. Restart `npm run dev`.

Cached 1 hour. Attribution is required and shown in the UI.

### Inventory (mall times)

Three ways to get them, in order of how much they're worth:

1. **Licensed feed** — ask SM Prime / Ayala Cinemas / a Vista or GMovies reseller for a showtimes feed and deep-link params, or buy a commercial showtimes API (MovieGlu covers PH). This is the actual product; everything else is a stopgap.
2. **Browser capture (`npm run capture`)** — reads each chain’s own API through a real browser. Fast and accurate, but undocumented and almost certainly against their ToS. Development use.

```
npm run capture                 # cinema chains + SM Tickets / Eventbrite / WTC / CCP / SMX
npm run capture -- --days=14    # forwarded to cinema scripts only
npm run capture:sm              # one cinema chain
npm run capture:events          # live events only (sm-tickets, eventbrite, wtc, ccp, smx)
npm run capture:sm-tickets      # concerts/sports → data/events.json
npm run capture:eventbrite      # comedy/expos (Manila + regional PH)
npm run capture:wtc             # World Trade Center expos
npm run capture:ccp             # Cultural Center of the Philippines
npm run capture:smx             # SMX Manila + Clark/Cebu/Davao/Bacolod/…
```
3. **Ops ingest (`npm run ingest`)** — a human copies the official schedule, runs one command, times go live. Slow but unimpeachable, and the fallback when capture breaks.

#### Browser capture (SM Cinema)

```
npm run capture:sm             # every SM site in data/sm-cinemas.json, next 7 dates
npm run capture:sm -- --days=30
npm run capture:sm -- --only=c-sm-dasma
npm run capture:sm -- --inspect
npm run sync:sm              # rebuild cinema list from data/sm-sites.raw.json
```

#### Browser capture (Megaworld)

```
npm run capture:megaworld             # Eastwood, Newport, Venice, Uptown — next 7 dates
npm run capture:megaworld -- --days=14
npm run capture:megaworld -- --only=eastwood
```

Megaworld's real booker is [tickets.megaworldcinemas.com](https://tickets.megaworldcinemas.com) (HelixPay), not the marketing site. Schedules live in SSR HTML: each mall category lists film×screen products; each product page embeds date and timeslot options. `scripts/capture-megaworld.ts` fetches those pages with plain `fetch` — no browser needed. Festive Walk, Lucky Chinatown, and Southwoods are not on the tickets subdomain yet.

#### Browser capture (Robinsons)

```
npm run capture:robinsons
npm run capture:robinsons -- --days=7
npm run capture:robinsons -- --only=dasma
```

[robinsonsmovieworld.com](https://robinsonsmovieworld.com) exposes ASP.NET webservices (`getbranches`, `GetScreeningDetailsList`, `getschedulesbybranchandmovie`). Responses are double-encoded JSON and calls must run inside a real browser session — `scripts/capture-robinsons.ts` boots `cinema/nowshowing`, maps `Branch_Key` → `c-rob-*`, then walks branch → film → date → clock time.

#### Browser capture (Ayala Malls)

```
npm run capture:ayala
npm run capture:ayala -- --days=7
npm run capture:ayala -- --only=greenbelt
```

#### Browser capture (Vista Cinemas)

```
npm run capture:vista
npm run capture:vista -- --days=14
npm run capture:vista -- --only=evia
```

[Vista Cinemas](https://www.vistacinemas.com.ph/) (Vista Mall + Starmall, Parallax/myCinema) exposes ASP.NET JSON at `Branches/GetBranchesSlug`, `Movie/NowShowingMovies`, and `Movie/Schedules`. `scripts/capture-vista.ts` drives a real browser session and writes into `data/showtimes.json`.

#### Browser capture (Fisher Mall)

```
npm run capture:fisher
npm run capture:fisher -- --days=14
```

[Fisher Mall box office](https://fisherboxoffice.fishermall.com.ph/) exposes `webservice/GetCinemaSchedules` (double-encoded JSON, same family as Robinsons).

#### Browser capture (Power Plant)

```
npm run capture:powerplant
npm run capture:powerplant -- --days=14
npm run capture:powerplant -- --only=alabang
```

[Power Plant Cinema](https://powerplantcinema.com/bin/homepage.php) sells via Vista `WSVistaWebClient/OData.svc` (`Films` + `Sessions`) on the Rockwell tickets host. Makati (`0001`) and Alabang Town Center (`0003`) share that feed.

**Gateway Cineplex** is listed from [Ticketnet](https://www.ticketnet.com.ph/gateway-cineplex-18-movies) for directory + booker links only — Ticketnet sells movies as events (month / time-range), not a per-showtime schedule feed we can ingest without inventing times.

[Ayala All Access](https://www.ayalaallaccess.com/) is Lumos/Vista — same OCAPI family as SM (`digital-api.ayalaallaccess.com/ocapi/v1`). `scripts/capture-ayala.ts` opens the homepage to mint a short-lived token, then queries every site id in `lib/ayala.ts`. Refresh the site list with `npx tsx scripts/dump-ayala-sites.ts`.

smcinema.com is a Lumos (Vista) SPA behind Cloudflare, so showtimes are never in the HTML — the page fetches them from Vista OCAPI (`digital-api.smcinema.com/ocapi/v1`) using a short-lived token it mints per page load. `scripts/capture-sm.ts` opens the page in a browser, borrows that header for the run, and reads the same JSON the site reads. The token is held in memory only — never logged, never written to disk.

No `playwright install` needed: this uses `playwright-core` to drive whichever Chrome, Edge or Chromium is already installed (Windows always has Edge). If none is found, install one — don't download a bundled browser.

Targets are every SM Cinema in `data/sm-cinemas.json` (78 sites nationwide). One browser session mints the OCAPI token; the rest are queried by site id so we don't load 78 pages. Refresh the list with `npx tsx scripts/dump-sm-sites.ts` then `npm run sync:sm` when SM opens a new mall. OCAPI returns start times already offset (`+08:00`) and titles as the cinema bills them.

Location pills: Metro Manila, Cavite, North Luzon, South Luzon, Cebu, Visayas, Davao, Mindanao (plus Bangkok for the demo Ayala-shaped entry). Cavite / Cebu / Davao stay first-class so a Dasma user isn't dumped into "South Luzon".

Catalog branches: SM from `data/sm-cinemas.json` (OCAPI dump), Ayala / Robinsons / Megaworld / Vista Cinemas from `data/partner-cinemas.json`. Booking goes to each chain’s official site — [Ayala All Access](https://www.ayalaallaccess.com/), Robinsons Movieworld, Megaworld tickets, [Vista Cinemas](https://www.vistacinemas.com.ph/) — until a licensed feed exists.

```
npm run inspect:booker             # list JSON endpoints the official booker pages hit
npm run inspect:booker -- --url=https://www.ayalaallaccess.com/
```

Megaworld, Robinsons, Ayala, Vista, Fisher, and Power Plant capture are wired alongside SM; live-event scrapers (SM Tickets, Eventbrite, WTC, CCP, SMX) run after the cinema chains. Or run events alone with `npm run capture:events`. Gateway is catalog-only until Ticketnet exposes discrete showtimes. Until inventory is refreshed, malls without rows still show in Find your cinema and link out to the official booker.

Known limits: format is inferred from the screen name plus the 3D-glasses flag, because OCAPI reports format as opaque attribute ids; prices are not fetched (they need a per-showtime call). Run `--inspect` first if it ever breaks — the endpoint list tells you what moved.

#### Ops ingest

1. Open the cinema's own schedule page.
2. Create `data/raw/sm-megamall-2026-09-10.txt` (see `data/raw/_example.txt`; files starting with `_` are skipped):

   ```
   cinema: c-sm-mega
   date: 2026-09-10

   Wicked: For Good | IMAX | 520
   11:00 AM, 1:40 PM, 4:20 PM
   ```

3. `npm run ingest`

Titles are matched against TMDB (PH now-playing first, then search). **Nothing is written if any title fails to match** — fix the spelling and re-run. Re-ingesting the same cinema and date replaces those rows, so it's safe to run repeatedly, and both paths share that merge so capture and ingest can't double up.

The title you type is the title the site shows — TMDB only supplies poster, synopsis, runtime and cast. That's deliberate: TMDB exports local films under English titles (`Himala` ships as "Miracle"), so the cinema's billing wins.

Page furniture in a paste (screen labels, prices, ratings, "Buy Tickets") is ignored, and every ignored line is printed. Check that list — a title dropped by mistake would hand its times to the movie above it.

Cinema ids come from `lib/seed.ts` (`c-sm-mega`, `c-sm-moa`, `c-ayala-gc`, …). Times are written with the city's fixed offset (`+08:00` PH, `+07:00` BKK) and taken **literally** — a 12:30 AM show must be filed under the date it actually starts.

`npm run check` runs the parser self-check plus a live TMDB fetch.

Production path is the same shape: replace the JSON file with rows in the `showtimes` table (`supabase/migrations/001_init.sql`).

## Outbound booking

We do not sell tickets. Booking goes to the cinema’s official site.
