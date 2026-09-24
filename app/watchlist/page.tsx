import { cookies } from "next/headers";
import { SavedList } from "@/components/saved-list";
import { CITY_COOKIE, cityLabel, parseCity } from "@/lib/cities";
import { getNextScreenings } from "@/lib/data";

export const revalidate = 300;

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const city = parseCity(
    typeof searchParams.city === "string" ? searchParams.city : undefined,
    cookies().get(CITY_COOKIE)?.value,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Saved</h1>
        <p className="mt-1 text-sm text-white/70">
          Movies and events on this phone. Next screenings for {cityLabel(city)}.
        </p>
      </div>
      <SavedList city={city} next={await getNextScreenings(city)} />
    </div>
  );
}
