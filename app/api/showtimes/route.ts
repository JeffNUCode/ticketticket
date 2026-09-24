import { NextResponse } from "next/server";
import { parseCity } from "@/lib/cities";
import { getFilteredShowtimes, isoDate } from "@/lib/data";
import type { CinemaChain, ScreenType } from "@/types/database";

export const revalidate = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const data = await getFilteredShowtimes({
    city: parseCity(searchParams.get("city") ?? undefined),
    date: searchParams.get("date") ?? isoDate(),
    chain: (searchParams.get("chain") ?? "all") as CinemaChain | "all",
    format: (searchParams.get("format") ?? "all") as ScreenType | "all",
  });
  return NextResponse.json(data);
}
