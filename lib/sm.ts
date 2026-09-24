import { assignArea } from "./cities";
import type { CinemaRow } from "@/types/database";

/** Keep promo / existing inventory ids stable when SM's site numbers don't change. */
const LEGACY_IDS: Record<string, string> = {
  "2102": "c-sm-mega",
  "2022": "c-sm-moa",
  "2402": "c-sm-dasma",
  "2004": "c-sm-cebu",
  "2902": "c-sm-davao",
};

export function smCinemaId(siteId: string) {
  return LEGACY_IDS[siteId] ?? `c-sm-${siteId}`;
}

export function smSiteSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/gi, "n")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function smBookingUrl(name: string, siteId: string) {
  return `https://www.smcinema.com/sites/${smSiteSlug(name)}/${siteId}`;
}

export function assignSmCity(text: string) {
  return assignArea(text);
}

export type OcapiSite = {
  id: string;
  name: { text: string };
  location?: { latitude?: number; longitude?: number };
  contactDetails?: {
    address?: { line1?: string; line2?: string; city?: string };
  };
};

export function siteToCinema(site: OcapiSite): CinemaRow {
  const name = site.name.text.trim();
  const addr = site.contactDetails?.address;
  const blob = [name, addr?.line1, addr?.line2, addr?.city].filter(Boolean).join(", ");
  const address = [addr?.line1, addr?.line2, addr?.city].filter(Boolean).join(", ");
  return {
    id: smCinemaId(site.id),
    name: `${name} Cinema`,
    chain: "SM Cinema",
    city: assignSmCity(blob),
    mall: name,
    address: address || name,
    latitude: site.location?.latitude ?? 0,
    longitude: site.location?.longitude ?? 0,
    website_booking_url: smBookingUrl(name, site.id),
  };
}
