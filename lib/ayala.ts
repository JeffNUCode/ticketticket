/** Ayala All Access — Vista OCAPI at digital-api.ayalaallaccess.com (same stack as SM). */

export const AYALA_API = "https://digital-api.ayalaallaccess.com/ocapi/v1";
export const AYALA_BOOT = "https://www.ayalaallaccess.com/";

/** Vista site id → our cinema id. Legazpi (1014) not in partner catalog yet. */
export const AYALA_SITE_IDS: Record<string, string> = {
  "1001": "c-ayala-glorietta",
  "1003": "c-ayala-gc",
  "1004": "c-ayala-cebu",
  "1005": "c-ayala-market",
  "1006": "c-ayala-trinoma",
  "1007": "c-ayala-marquee",
  "1009": "c-ayala-harbor",
  "1010": "c-ayala-centrio",
  "1011": "c-ayala-fairview",
  "1012": "c-ayala-bhs",
  "1013": "c-ayala-nuvali",
  "1014": "c-ayala-legazpi",
  "1015": "c-ayala-uptown-qc",
  "1017": "c-ayala-vertis",
  "1018": "c-ayala-cloverleaf",
  "1019": "c-ayala-feliz",
  "1020": "c-ayala-circuit",
  "1021": "c-ayala-capitol",
  "1022": "c-ayala-bgc", // Manila Bay (legacy id)
  "1023": "c-ayala-central-bloc",
  "1024": "c-ayala-vermosa",
};

export function ayalaBookingUrl(siteId: string, siteName: string) {
  const slug = siteName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://www.ayalaallaccess.com/sites/${slug}/${siteId}`;
}

export function ayalaSiteIdOf(bookingUrl: string) {
  const id = new URL(bookingUrl).pathname.split("/").filter(Boolean).pop();
  return id && /^\d+$/.test(id) ? id : null;
}
