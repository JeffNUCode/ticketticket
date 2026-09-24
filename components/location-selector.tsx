"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2, MapPin } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LOCATION_FILTERS, cityCenter, cityCookie, cityLabel, filterIdForCity, nearestCity, readOrigin, writeOrigin } from "@/lib/cities";
import type { Origin } from "@/lib/group";
import { cn } from "@/lib/utils";
import type { CitySlug, LocationFilterId } from "@/types/database";

/**
 * GPS pin if "Near me" was used this session, else the city centroid. Shared so every
 * mall list sorts by the same origin instead of each caller inventing one.
 */
export function useOrigin(city: LocationFilterId) {
  const [origin, setOrigin] = useState<Origin | null>(() => cityCenter(city));
  useEffect(() => {
    setOrigin(readOrigin() ?? cityCenter(city));
  }, [city]);
  return origin ?? undefined;
}

export function LocationSelector({
  city,
  cities,
  compact = false,
  remember = true,
  prominent = false,
}: {
  city?: LocationFilterId;
  /** Inventory city slugs — a chip shows if it covers any of these (or all chips if empty). */
  cities: CitySlug[];
  compact?: boolean;
  remember?: boolean;
  /** Soft ask: region chips first; GPS is optional. */
  prominent?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [status, setStatus] = useState<"idle" | "locating" | "failed">("idle");
  const [open, setOpen] = useState(!compact);

  const activeFilter: LocationFilterId | undefined =
    city === "all" ? "all" : city ? filterIdForCity(city) : undefined;
  const options = LOCATION_FILTERS.filter(
    (f) => f.id === "all" || cities.length === 0 || f.cities.some((c) => cities.includes(c)),
  );

  useEffect(() => {
    if (remember && city) {
      document.cookie = cityCookie(city === "all" ? "all" : filterIdForCity(city));
    }
  }, [city, remember]);

  function setCity(next: LocationFilterId) {
    const id = next === "all" ? "all" : filterIdForCity(next);
    document.cookie = cityCookie(id);
    const p = new URLSearchParams(params.toString());
    p.set("city", id);
    if (pathname === "/") p.delete("date");
    setOpen(false);
    router.push(`${pathname}?${p.toString()}`);
  }

  function detect() {
    if (!navigator.geolocation) return setStatus("failed");
    setStatus("locating");
    const allowed = options.flatMap((f) => f.cities);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        writeOrigin(pos.coords.latitude, pos.coords.longitude);
        setStatus("idle");
        setCity(nearestCity(pos.coords.latitude, pos.coords.longitude, allowed));
      },
      () => setStatus("failed"),
      { timeout: 8000 },
    );
  }

  const near = (
    <button
      type="button"
      onClick={detect}
      disabled={status === "locating"}
      className="press flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold text-white/80 hover:text-white disabled:opacity-60 sm:w-auto"
    >
      {status === "locating" ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <MapPin className="h-4 w-4" aria-hidden />
      )}
      {status === "locating" ? "Finding places near you…" : "Use my location (optional)"}
    </button>
  );

  const rail = (
    <div
      className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
      role="group"
      aria-label="Area"
    >
      <button
        type="button"
        onClick={detect}
        disabled={status === "locating"}
        hidden={prominent}
        className="press flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 text-sm font-semibold text-white/80 hover:text-white disabled:opacity-60"
      >
        {status === "locating" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <MapPin className="h-4 w-4" aria-hidden />
        )}
        {status === "locating" ? "Locating…" : "Near me"}
      </button>
      {options.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => setCity(f.id)}
          aria-pressed={activeFilter === f.id}
          className={cn(
            "press min-h-11 shrink-0 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold",
            activeFilter === f.id
              ? "border-2 border-ink bg-zap text-black"
              : "border border-white/15 text-white/70 hover:text-white",
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      {prominent && (
        <div className="mb-3 space-y-2">
          <p className="text-xs text-white/60">Pick a region:</p>
          {rail}
          <div className="pt-1">{near}</div>
        </div>
      )}
      {compact && city && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="press mb-2 flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink bg-zap px-3 text-sm font-bold text-black"
        >
          {cityLabel(city)}
          <ChevronDown className={cn("h-4 w-4", open && "rotate-180")} aria-hidden />
        </button>
      )}
      {!prominent && (!compact || open) && rail}
      {status === "failed" && (
        <p role="status" className="mt-1 text-xs text-white/60">
          Couldn&apos;t get your location. Pick a region instead.
        </p>
      )}
    </div>
  );
}
