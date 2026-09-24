import { ExternalLink } from "lucide-react";
import { OFFICIAL_BOOKERS } from "@/lib/bookers";
import type { CinemaRow } from "@/types/database";

type BookerLink = { label: string; url: string; sub?: string };

/** When we have no inventory, give a clear path to the chain/mall booker. */
export function BookOnSite({
  cinemas = [],
  links,
  heading = "Check the cinema’s site",
  note = "We don’t have times here yet — schedules live on the cinema’s own booking page.",
}: {
  cinemas?: CinemaRow[];
  /** Chain-level bookers when no specific mall is known. */
  links?: readonly BookerLink[];
  heading?: string;
  note?: string;
}) {
  const fromMalls = dedupeBookers(cinemas);
  const items: BookerLink[] =
    fromMalls.length > 0
      ? fromMalls
      : links?.length
        ? [...links]
        : OFFICIAL_BOOKERS.map((b) => ({ label: b.chain, url: b.url }));

  return (
    <div className="space-y-3">
      <div>
        <h2 className="section-title">{heading}</h2>
        <p className="mt-1 text-sm text-white/55">{note}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((b) => (
          <li key={`${b.label}-${b.url}`}>
            <a
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
              className="panel flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:border-zap"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-white">{b.label}</span>
                {b.sub && <span className="block text-xs text-white/45">{b.sub}</span>}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-zap">
                Open site
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function dedupeBookers(cinemas: CinemaRow[]): BookerLink[] {
  const seen = new Set<string>();
  const out: BookerLink[] = [];
  for (const c of cinemas) {
    if (seen.has(c.website_booking_url)) continue;
    seen.add(c.website_booking_url);
    out.push({ label: c.mall, sub: c.chain, url: c.website_booking_url });
  }
  return out;
}
