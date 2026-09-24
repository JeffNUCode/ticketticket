"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

/** Loads the AdSense script once. No-op without NEXT_PUBLIC_ADSENSE_CLIENT. */
export function AdSenseScript() {
  if (!CLIENT) return null;
  return (
    <Script
      id="adsense"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}

/**
 * Display unit. Place only below the book path (after mall lists / page body).
 * Needs a slot id from AdSense → Ads → By ad unit.
 */
export function AdUnit({
  slot,
  format = "auto",
  className,
}: {
  slot: string;
  format?: "auto" | "rectangle" | "horizontal";
  className?: string;
}) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!CLIENT || !slot || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // Ad blockers / missing script — fail quiet.
    }
  }, [slot]);

  if (!CLIENT || !slot) return null;

  return (
    <aside className={className} aria-label="Sponsored">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
        Sponsored
      </p>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}

/** Footer / below-fold unit — uses NEXT_PUBLIC_ADSENSE_SLOT_FOOTER. */
export function AdSenseFooter() {
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOOTER;
  if (!CLIENT || !slot) return null;
  return <AdUnit slot={slot} format="horizontal" className="mt-6" />;
}
