"use client";

import { Play } from "lucide-react";
import { useState } from "react";

export function Trailer({ youtubeId }: { youtubeId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <h2 className="section-title mb-3">Trailer</h2>
      {open ? (
        <iframe
          title="Trailer"
          className="aspect-video w-full rounded-2xl"
          src={`https://www.youtube.com/embed/${youtubeId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="panel flex aspect-video w-full flex-col items-center justify-center gap-2 hover:border-zap"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-zap text-black">
            <Play className="h-6 w-6 fill-black" aria-hidden />
          </span>
          <span className="text-sm font-semibold">Play trailer</span>
        </button>
      )}
    </section>
  );
}
