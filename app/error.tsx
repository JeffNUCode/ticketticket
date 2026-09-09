"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="panel p-8 text-center">
      <p className="page-title">Something broke</p>
      <p className="mt-2 text-sm text-white/55">{error.message}</p>
      <Button variant="gold" className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
