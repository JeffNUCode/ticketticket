"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/lib/watchlist";

/** Save a movie to the local list (this device only). */
export function SaveButton({
  movieId,
  title,
  slug,
  poster,
}: {
  movieId: string;
  title: string;
  slug: string;
  poster?: string;
}) {
  const { has, toggle } = useWatchlist();
  const on = has(movieId);
  return (
    <Button
      variant={on ? "secondary" : "outline"}
      onClick={() => toggle({ kind: "movie", movieId, title, slug, poster })}
      aria-pressed={on}
    >
      <Heart className={cn("h-4 w-4", on && "fill-zap text-zap")} aria-hidden />
      {on ? "Saved" : "Save this movie"}
    </Button>
  );
}

/** @deprecated Use SaveButton */
export const NotifyButton = SaveButton;
