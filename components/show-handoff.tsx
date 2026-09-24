"use client";

import { ExternalLink, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { formatClock, formatDay, peso } from "@/lib/utils";

export type ShowHandoff = {
  title: string;
  poster?: string;
  start_time: string;
  mall: string;
  cinema_name: string;
  chain: string;
  booking_url: string;
  screen_type?: string;
  price?: number | null;
};

/** Confirm screening, then leave to the cinema's site. */
export function ShowBookDrawer({
  show,
  open,
  onClose,
}: {
  show: ShowHandoff | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title="Book on the cinema's site">
      {show && (
        <div className="space-y-4">
          <div className="panel flex gap-3 p-4">
            {show.poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={show.poster}
                alt=""
                className="h-[4.5rem] w-12 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight text-white">{show.title}</p>
              <p className="mt-1 text-sm text-white/80">
                {formatDay(show.start_time)} · {formatClock(show.start_time)}
                {show.screen_type && show.screen_type !== "2D" ? ` · ${show.screen_type}` : ""}
                {show.price != null ? ` · ${peso(show.price)}` : ""}
              </p>
              <p className="mt-1 text-sm text-white/60">{show.cinema_name}</p>
            </div>
          </div>
          <p className="text-sm text-white/70">
            Tickets continue on {show.chain}&apos;s site — GoSee! doesn&apos;t sell them. Find{" "}
            {formatClock(show.start_time)} on {formatDay(show.start_time)} at {show.mall}.
          </p>
          <Button variant="gold" size="lg" className="w-full" asChild>
            <a href={show.booking_url} target="_blank" rel="noopener noreferrer">
              <Ticket className="h-5 w-5" aria-hidden />
              Continue on {show.chain}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </Button>
        </div>
      )}
    </Drawer>
  );
}
