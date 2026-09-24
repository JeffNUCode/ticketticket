"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DISCOVER_HUBS,
  EVENT_DISCOVER_TABS,
  PLACE_TABS,
  defaultTabForHub,
  discoverHub,
  discoverTabLabel,
  type DiscoverCounts,
  type DiscoverHub,
  type DiscoverTab,
} from "@/types/discover";

export function CategoryToggle({
  active,
  counts,
  /** When false, hubs scroll away so Movies times keep the viewport. */
  sticky = true,
}: {
  active: DiscoverTab;
  /** Hide sub-tabs with zero inventory. Active tab always shown. */
  counts?: DiscoverCounts;
  sticky?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const hub = discoverHub(active);

  function go(tab: DiscoverTab) {
    const next = new URLSearchParams(params.toString());
    if (tab === "movies") next.delete("category");
    else next.set("category", tab);
    if (tab !== "movies") {
      next.delete("chain");
      next.delete("format");
      next.delete("date");
    }
    const q = next.toString();
    router.replace(q ? `/?${q}` : "/");
  }

  function goHub(nextHub: DiscoverHub) {
    go(defaultTabForHub(nextHub, counts));
  }

  const liveTabs = EVENT_DISCOVER_TABS.filter(
    (id) => id === active || !counts || (counts[id] ?? 0) > 0,
  );
  const nearbyTabs = PLACE_TABS.filter(
    (id) => id === active || !counts || (counts[id] ?? 0) > 0,
  );

  return (
    <div
      className={cn(
        "-mx-4 border-b border-white/10 px-4 md:-mx-0 md:px-0",
        sticky && "sticky top-[4.5rem] z-20 bg-neutral-950/92 backdrop-blur",
      )}
    >      <div
        role="toolbar"
        aria-label="Discover"
        className="flex gap-1 overflow-x-auto py-2 no-scrollbar"
      >
        {DISCOVER_HUBS.map((h) => {
          const on = hub === h.id;
          return (
            <button
              key={h.id}
              type="button"
              aria-pressed={on}
              onClick={() => goHub(h.id)}
              className={cn(
                "press min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition",
                on
                  ? "border-2 border-ink bg-zap text-black"
                  : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              {h.label}
            </button>
          );
        })}
      </div>

      {hub === "live" && liveTabs.length > 0 && (
        <div
          role="toolbar"
          aria-label="Live events"
          className="flex gap-1 overflow-x-auto pb-2 no-scrollbar"
        >
          {liveTabs.map((id) => (
            <SubChip key={id} active={active === id} onClick={() => go(id)}>
              {discoverTabLabel(id)}
            </SubChip>
          ))}
        </div>
      )}

      {hub === "nearby" && nearbyTabs.length > 0 && (
        <div
          role="toolbar"
          aria-label="Nearby places"
          className="flex gap-1 overflow-x-auto pb-2 no-scrollbar"
        >
          {nearbyTabs.map((id) => (
            <SubChip key={id} active={active === id} onClick={() => go(id)}>
              {discoverTabLabel(id)}
            </SubChip>
          ))}
        </div>
      )}
    </div>
  );
}

function SubChip({
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
        "press min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold transition",
        active
          ? "border border-zap bg-zap/15 text-zap"
          : "border border-transparent text-white/55 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
