"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="panel p-8 text-center">
      <p className="page-title">That didn&apos;t load</p>
      <p className="mt-2 text-sm text-white/55">
        Showtimes couldn&apos;t be fetched just now. Try again, or book on the cinema&apos;s site.
      </p>
      <Button variant="gold" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
