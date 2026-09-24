/**
 * Prove Megaworld category → product → date × timeslot extraction.
 *   npx tsx scripts/peek-mega-tickets.ts
 */
import "./env";
import { parseMegaCategory, parseMegaProduct } from "../lib/mega";

const BASE = "https://tickets.megaworldcinemas.com";
const SLUG = process.argv.find((a) => a.startsWith("--slug="))?.slice("--slug=".length) ?? "eastwood";

async function main() {
  const catUrl = `${BASE}/categories/${SLUG}`;
  const catRes = await fetch(catUrl, {
    headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
  });
  const catHtml = await catRes.text();
  const products = parseMegaCategory(catHtml, SLUG);
  console.log(`category ${SLUG}: ${products.length} products`);
  console.log(products.slice(0, 5));

  if (products.length === 0) return;

  const p = products[0];
  const prodRes = await fetch(`${BASE}/products/${p.slug}?group=${SLUG}`, {
    headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
  });
  const detail = parseMegaProduct(await prodRes.text());
  console.log("\nfirst product detail:", JSON.stringify(detail, null, 2));

  let slots = 0;
  for (const prod of products.slice(0, 3)) {
    const res = await fetch(`${BASE}/products/${prod.slug}?group=${SLUG}`, {
      headers: { "user-agent": "Mozilla/5.0", accept: "text/html" },
    });
    const d = parseMegaProduct(await res.text());
    const n = d.dates.length * d.times.length;
    slots += n;
    console.log(`\n${prod.title} (${prod.slug}): ${d.dates.length} dates × ${d.times.length} times = ${n}`);
    console.log("  screen:", d.screen, " sample:", d.times[0], d.dates[0]);
  }
  console.log(`\npreview slots from 3 products: ${slots}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
