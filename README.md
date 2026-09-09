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
2. **Browser capture (`npm run capture:sm`)** — reads SM's own API through a real browser. Fast and accurate, but undocumented and almost certainly against their ToS. Development use.
3. **Ops ingest (`npm run ingest`)** — a human copies the official schedule, runs one command, times go live. Slow but unimpeachable, and the fallback when capture breaks.

#### Browser capture (SM Cinema)

```
npm run capture:sm             # up to 30 published dates, every SM cinema in lib/seed.ts
npm run capture:sm -- --days=7    # shorter window
npm run capture:sm -- --inspect   # list the JSON endpoints, write nothing
```

smcinema.com is a Lumos (Vista) SPA behind Cloudflare, so showtimes are never in the HTML — the page fetches them from Vista OCAPI (`digital-api.smcinema.com/ocapi/v1`) using a short-lived token it mints per page load. `scripts/capture-sm.ts` opens the page in a browser, borrows that header for the run, and reads the same JSON the site reads. The token is held in memory only — never logged, never written to disk.

No `playwright install` needed: this uses `playwright-core` to drive whichever Chrome, Edge or Chromium is already installed (Windows always has Edge). If none is found, install one — don't download a bundled browser.

Targets are derived from `lib/seed.ts`: any cinema whose `website_booking_url` is an SM site page (`…/sites/SM-City-Dasmarinas/2402`). Add a cinema there and it gets captured. OCAPI returns start times already offset (`+08:00`) and titles as the cinema bills them, so no timezone or title fixing is needed on this path.

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
