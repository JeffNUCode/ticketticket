"use client";

import { ExternalLink, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export const EVENT_POSTER_FALLBACK = "/event-thumb.png";

export function sellerHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "the official site";
  }
}

export function EventPoster({
  src,
  className,
}: {
  src?: string;
  className?: string;
}) {
  const fallback = !src;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || EVENT_POSTER_FALLBACK}
      alt=""
      loading="lazy"
      onError={(e) => {
        const el = e.currentTarget;
        if (el.dataset.fallback === "1") return;
        el.dataset.fallback = "1";
        el.src = EVENT_POSTER_FALLBACK;
        el.classList.remove("object-cover");
        el.classList.add("object-contain", "p-1.5", "bg-black");
      }}
      className={cn(
        "h-24 w-16 shrink-0 rounded-lg",
        fallback ? "object-contain bg-black p-1.5" : "object-cover bg-white/5",
        className,
      )}
    />
  );
}

export type EventHandoff = {
  title: string;
  bookingUrl: string;
  poster?: string;
  venue?: string;
  when?: string;
  subtitle?: string;
};

/** Confirm when/where, then leave to the official seller. */
export function EventBookDrawer({
  event,
  open,
  onClose,
}: {
  event: EventHandoff | null;
  open: boolean;
  onClose: () => void;
}) {
  const host = event ? sellerHost(event.bookingUrl) : "";
  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title="Book on the official site">
      {event && (
        <div className="space-y-4">
          <div className="panel flex gap-3 p-4">
            <EventPoster src={event.poster} />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight text-white">{event.title}</p>
              {event.subtitle && <p className="mt-1 text-sm text-white/70">{event.subtitle}</p>}
              {event.when && <p className="mt-1 text-sm text-white/80">{event.when}</p>}
              {event.venue && <p className="mt-1 text-sm text-white/60">{event.venue}</p>}
            </div>
          </div>
          <p className="text-sm text-white/70">
            Tickets continue on {host} — GoSee! doesn&apos;t sell them.
          </p>
          <Button variant="gold" size="lg" className="w-full" asChild>
            <a href={event.bookingUrl} target="_blank" rel="noopener noreferrer">
              <Ticket className="h-5 w-5" aria-hidden />
              Continue on {host}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </Button>
        </div>
      )}
    </Drawer>
  );
}
