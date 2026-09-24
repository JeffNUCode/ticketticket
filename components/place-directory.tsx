"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { CinemaSearch } from "@/components/cinema-search";
import { cityCenter, cityInFilter, cityLabel, readOrigin } from "@/lib/cities";
import { haversineKm, cn } from "@/lib/utils";
import { PLACE_KIND_LABEL, mapsUrl, matchesPlace, type Place, type PlaceKind } from "@/types/places";
import type { LocationFilterId } from "@/types/database";

const KINDS: PlaceKind[] = ["restaurant", "cafe", "pub", "bar", "club", "entertainment"];

export function PlaceDirectory({
  places,
  city,
  /** When set (Discover category), skip the kind chips — list is already parted. */
  lockedKind,
}: {
  places: Place[];
  city: LocationFilterId;
  lockedKind?: PlaceKind;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<PlaceKind | "all">(lockedKind ?? "all");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const pin = gps ?? cityCenter(city);

  useEffect(() => {
    setKind(lockedKind ?? "all");
    setGps(readOrigin());
  }, [city, lockedKind]);

  const list = useMemo(() => {
    const activeKind = lockedKind ?? kind;
    return places
      .filter((p) => city === "all" || cityInFilter(city, p.city))
      .filter((p) => matchesPlace(p, q))
      .filter((p) => (activeKind === "all" ? true : p.kind === activeKind))
      .sort((a, b) => {
        if (pin) {
          const d =
            haversineKm(pin, { lat: a.lat, lng: a.lng }) -
            haversineKm(pin, { lat: b.lat, lng: b.lng });
          if (d !== 0) return d;
        }
        return a.name.localeCompare(b.name);
      });
  }, [places, q, kind, lockedKind, city, pin]);

  const availableKinds = useMemo(() => {
    const present = new Set(places.map((p) => p.kind));
    return KINDS.filter((k) => present.has(k));
  }, [places]);

  return (
    <div className="space-y-4">
      <CinemaSearch
        value={q}
        onChange={setQ}
        placeholder="Search place, area, or vibe"
        label="Search places"
      />

      {!lockedKind && (
        <div
          role="toolbar"
          aria-label="Place type"
          className="no-scrollbar flex gap-2 overflow-x-auto pb-1"
        >
          <KindChip active={kind === "all"} onClick={() => setKind("all")}>
            All
          </KindChip>
          {availableKinds.map((k) => (
            <KindChip key={k} active={kind === k} onClick={() => setKind(k)}>
              {PLACE_KIND_LABEL[k]}
            </KindChip>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-white/70">No places match “{q || lockedKind || kind}”.</p>
      ) : (
        <>
          <p className="text-xs text-white/60">
            {list.length} place{list.length === 1 ? "" : "s"}
            {pin
              ? ` · nearest to ${gps ? "you" : city === "all" ? "PH" : cityLabel(city)} first`
              : ""}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {list.map((p) => {
              const km = pin ? haversineKm(pin, { lat: p.lat, lng: p.lng }) : null;
              return (
                <li key={p.id} className="panel flex h-full flex-col p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
                    {PLACE_KIND_LABEL[p.kind].replace(/s$/, "")}
                    {city === "all" ? ` · ${cityLabel(p.city)}` : ""}
                  </p>
                  <p className="font-display text-lg font-bold text-white">{p.name}</p>
                  <p className="text-sm text-white/70">
                    {p.area}
                    {km != null ? ` · ${km < 10 ? km.toFixed(1) : Math.round(km)} km` : ""}
                  </p>
                  <p className="mt-1 text-sm text-white/60">{p.address}</p>
                  {p.tags.length > 0 && (
                    <p className="mt-2 text-xs text-white/55">{p.tags.slice(0, 4).join(" · ")}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <a
                      href={mapsUrl(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-zap hover:underline"
                    >
                      Open in Maps
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                    {p.website && (
                      <a
                        href={p.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-white/70 hover:text-white hover:underline"
                      >
                        Website
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="pt-2 text-center text-sm text-white/55">
        Can&apos;t find a place, or want yours listed?{" "}
        <a
          href="mailto:hello@gosee.ph?subject=Suggest%20a%20place%20on%20GoSee!"
          className="font-semibold text-zap underline-offset-2 hover:underline"
        >
          Email us
        </a>{" "}
        and we&apos;ll add it.
      </p>
    </div>
  );
}

function KindChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "press min-h-11 shrink-0 rounded-full px-3.5 text-sm font-semibold",
        active
          ? "border-2 border-ink bg-zap text-black"
          : "border border-white/15 text-white/70 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
