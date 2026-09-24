"use client";

import { useMemo, useState } from "react";
import { BookOnSite } from "@/components/book-on-site";
import { CinemaSearch } from "@/components/cinema-search";
import { DateRail } from "@/components/discover-board";
import { useOrigin } from "@/components/location-selector";
import { MallTimes } from "@/components/showtime-list";
import { cityLabel } from "@/lib/cities";
import { matchesCinema } from "@/lib/ingest";
import { groupByMall, type ShowtimeView } from "@/lib/group";
import { horizonDates, localDateKey, phNoon } from "@/lib/utils";
import type { LocationFilterId } from "@/types/database";

export function MovieShowtimes({
  city,
  showtimes,
  bookers,
}: {
  city: LocationFilterId;
  showtimes: ShowtimeView[];
  bookers: readonly { chain: string; url: string }[];
}) {
  const [q, setQ] = useState("");
  const origin = useOrigin(city);

  /** A film runs for weeks. Without a day, every clock time here means "some evening". */
  const dates = useMemo(
    () => horizonDates(showtimes, city, localDateKey()),
    [showtimes, city],
  );
  const [picked, setDate] = useState(dates[0]);
  /** Switching city keeps the old selection, which that city may not screen on. */
  const date = dates.includes(picked) ? picked : dates[0];

  const onDate = useMemo(
    () => showtimes.filter((s) => localDateKey(new Date(s.start_time)) === date),
    [showtimes, date],
  );
  const list = useMemo(() => onDate.filter((s) => matchesCinema(s.cinema, q)), [onDate, q]);

  return (
    <section>
      <h2 className="section-title mb-3">Showtimes in {cityLabel(city)}</h2>

      {showtimes.length === 0 ? (
        <BookOnSite
          heading="No times in the app for this film"
          note={`Nothing upcoming in ${cityLabel(city)}. Switch city above, or check the cinema’s own booking site.`}
          links={bookers.map((b) => ({ label: b.chain, url: b.url }))}
        />
      ) : (
        <div className="space-y-3">
          {dates.length > 1 && <DateRail dates={dates} date={date} onPick={setDate} />}
          {groupByMall(onDate).length > 4 && <CinemaSearch value={q} onChange={setQ} />}
          {list.length === 0 ? (
            <p className="text-sm text-white/70">
              {onDate.length === 0
                ? `No screenings on ${phNoon(date).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}. Pick another day above.`
                : `No cinema here matches “${q}”.`}
            </p>
          ) : (
            <MallTimes showtimes={list} showTitles={false} origin={origin} />
          )}
        </div>
      )}
    </section>
  );
}
