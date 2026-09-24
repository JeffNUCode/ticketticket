"use client";

import { Search } from "lucide-react";

export function CinemaSearch({
  value,
  onChange,
  placeholder = "Search your cinema",
  label = "Search your cinema",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <span className="relative block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
          aria-hidden
        />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="min-h-11 w-full rounded-xl border border-white/15 bg-neutral-900 py-2 pl-10 pr-3 text-sm text-white placeholder:text-white/40"
        />
      </span>
    </label>
  );
}
