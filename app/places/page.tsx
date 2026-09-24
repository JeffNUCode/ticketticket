import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CITY_COOKIE, parseCity } from "@/lib/cities";

/** Places live under Discover categories — keep this URL as a shortcut. */
export default function PlacesRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const city = parseCity(
    typeof searchParams.city === "string" ? searchParams.city : undefined,
    cookies().get(CITY_COOKIE)?.value,
  );
  const kind =
    typeof searchParams.kind === "string" && searchParams.kind
      ? searchParams.kind
      : "restaurant";
  redirect(`/?city=${city}&category=${encodeURIComponent(kind)}`);
}
