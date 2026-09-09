"use client";

import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/lib/watchlist";

export function NotifyButton({
  movieId,
  title,
  screenType = "IMAX",
}: {
  movieId: string;
  title: string;
  screenType?: string;
}) {
  const { has, toggle } = useWatchlist();
  const on = has(movieId, screenType);
  return (
    <Button
      variant={on ? "secondary" : "outline"}
      onClick={() => toggle(movieId, screenType)}
      aria-pressed={on}
    >
      {on ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      {on ? `${screenType} alert is on` : `Notify me for ${screenType} · ${title}`}
    </Button>
  );
}
