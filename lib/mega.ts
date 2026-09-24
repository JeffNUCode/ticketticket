/** HelixPay tickets.megaworldcinemas.com — schedule lives in SSR HTML, not a public OCAPI. */

import type { ScreenType } from "@/types/database";

export const MEGA_TICKETS = "https://tickets.megaworldcinemas.com";

/** Maps HelixPay group slug → our cinema id. Festive/Lucky/Southwoods not on tickets subdomain yet. */
export const MEGA_GROUP: Record<string, string> = {
  eastwood: "c-mega-eastwood",
  newport: "c-mega-newport",
  "venice-cineplex": "c-mega-venice",
  uptown: "c-mega-u",
};

const GROUP_TOKEN: Record<string, string> = {
  eastwood: "eastwood",
  newport: "newport",
  "venice-cineplex": "venice",
  uptown: "uptown",
};

export type MegaGroup = { id: number; name: string; slug: string };

export type MegaCard = {
  slug: string;
  title: string;
  screen: ScreenType;
  price: number | null;
};

export type MegaShow = {
  title: string;
  slug: string;
  screen: ScreenType;
  dates: string[];
  /** clock start from timeslot value, e.g. 17:45 */
  times: string[];
};

function decode(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unescapeJson(s: string) {
  return s.replace(/\\u0026/g, "&").replace(/\\"/g, '"');
}

export function groupToken(group: string) {
  return GROUP_TOKEN[group] ?? group;
}

/** Film listing on a mall category page — skips food bundles and cross-mall nav cards. */
export function isFilmProduct(slug: string, group: string) {
  if (slug === group || slug === "venice-cineplex") return false;
  if (/food-bundle/i.test(slug)) return false;
  return slug.includes(groupToken(group));
}

function slugWindow(text: string, slug: string, span = 6000) {
  return text.match(new RegExp(`"slug":"${escRe(slug)}"[\\s\\S]{0,${span}}`))?.[0] ?? "";
}

/** Product cards on a category page. ponytail: regex on SSR blob; breaks if HelixPay changes embed shape. */
export function parseMegaCategory(html: string, group: string): MegaCard[] {
  const text = decode(html);
  const out: MegaCard[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(/"slug":"([^"]+)"/g)) {
    const slug = m[1];
    if (seen.has(slug) || !isFilmProduct(slug, group)) continue;
    const win = slugWindow(text, slug);
    if (!/"price":\d/.test(win)) continue;
    seen.add(slug);

    const title = unescapeJson(win.match(/"title":"((?:[^"\\]|\\.)*)"/)?.[1] ?? slugToTitle(slug));
    const screenRaw =
      win.match(/"storefront_card_description":"([^"]*)"/)?.[1] ||
      slug.match(/-(ultra-cinema|cinema-\d+[^-]*)/i)?.[1]?.replace(/-/g, " ") ||
      "2D";
    const price = Number(win.match(/"price":(\d+(?:\.\d+)?)/)?.[1]);

    out.push({
      slug,
      title: title.trim(),
      screen: screenLabel(screenRaw),
      price: Number.isFinite(price) ? price : null,
    });
  }

  return out;
}

export function parseMegaProduct(html: string, slug?: string): MegaShow {
  const text = decode(html);
  const productSlug = slug ?? text.match(/"slug":"([^"]+)"/)?.[1] ?? "";
  const win = productSlug ? slugWindow(text, productSlug, 12_000) : text;

  const title = unescapeJson(
    win.match(/"title":"((?:[^"\\]|\\.)*)"/)?.[1] ?? slugToTitle(productSlug),
  );
  const screenRaw =
    win.match(/"storefront_card_description":"([^"]*)"/)?.[1] ||
    productSlug.match(/-(ultra-cinema|cinema-\d+[^?]*)/i)?.[1]?.replace(/-/g, " ") ||
    "2D";

  // Date/timeslot blocks can sit far from the slug in huge SSR pages — scan the full HTML.
  const dates = optionValues(text, "date")
    .map((v) => v.value)
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v));
  const times = optionValues(text, "timeslot")
    .map((v) => v.value.split("-")[0])
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t));

  return {
    slug: productSlug,
    title: title.trim(),
    screen: screenLabel(screenRaw),
    dates: [...new Set(dates)].sort(),
    times: [...new Set(times)].sort(),
  };
}

function slugToTitle(slug: string) {
  const base = slug.replace(/-eastwood.*|-newport.*|-uptown.*|-venice.*/i, "");
  return base.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function optionValues(win: string, code: "date" | "timeslot") {
  const idx = win.indexOf(`"code":"${code}"`);
  if (idx < 0) return [] as { name: string; value: string }[];
  const valuesKey = win.indexOf('"values":', idx);
  if (valuesKey < 0) return [];
  const start = win.indexOf("[", valuesKey);
  if (start < 0) return [];
  let depth = 0;
  for (let i = start; i < win.length; i++) {
    if (win[i] === "[") depth++;
    else if (win[i] === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(win.slice(start, i + 1)) as { name: string; value: string }[];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

function screenLabel(raw: string): ScreenType {
  const u = raw.toUpperCase();
  if (/IMAX/.test(u)) return "IMAX";
  if (/ULTRA|A-LUXE|ALUXE|DIRECTOR|TEMPUR/.test(u)) return "Director's Club";
  if (/3D/.test(u)) return "3D";
  return "2D";
}

/** Combine date + HH:mm (24h from HelixPay) into PH ISO instant. */
export function megaStartIso(date: string, time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${date}T${hh}:${mm}:00+08:00`;
}

export function megaCategoryUrl(group: string) {
  return `${MEGA_TICKETS}/categories/${group}`;
}

export function megaProductUrl(group: string, productSlug: string) {
  return `${MEGA_TICKETS}/products/${productSlug}?group=${group}`;
}

export function phToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function filterMegaDates(dates: string[], days: number) {
  const start = phToday();
  const end = new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
  return dates.filter((d) => d >= start && d <= end);
}

export async function fetchMegaGroups(): Promise<MegaGroup[]> {
  const res = await fetch(`${MEGA_TICKETS}/api/available_product_groups`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Megaworld groups ${res.status}`);
  return res.json() as Promise<MegaGroup[]>;
}
