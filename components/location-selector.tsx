"use client";

import { MapPin } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { CITIES, nearestCity } from "@/lib/cities";
import { cn } from "@/lib/utils";
import type { CitySlug } from "@/types/database";

export function LocationSelector({ city }: { city: CitySlug }) {
  const router = useRouter();
  const params = useSearchParams();

  function setCity(next: CitySlug) {
    const p = new URLSearchParams(params.toString());
    p.set("city", next);
    router.push(`/?${p.toString()}`);
  }

  function detect() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCity(nearestCity(pos.coords.latitude, pos.coords.longitude)),
      () => setCity("metro-manila"),
      { timeout: 8000 },
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label="City">
      <button
        type="button"
        onClick={detect}
        className="press flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-3 text-sm font-semibold text-white/80 hover:text-white"
      >
        <MapPin className="h-4 w-4" aria-hidden />
        Near me
      </button>
      {CITIES.map((c) => (
        <button
          key={c.slug}
          type="button"
          onClick={() => setCity(c.slug)}
          aria-pressed={city === c.slug}
          className={cn(
            "press min-h-10 shrink-0 whitespace-nowrap rounded-full px-3 text-sm font-semibold",
            city === c.slug
              ? "border-2 border-ink bg-zap text-black"
              : "border border-white/15 text-white/70 hover:text-white",
          )}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
