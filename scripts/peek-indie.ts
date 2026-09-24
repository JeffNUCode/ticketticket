import "./env";
import { launchBrowser, UA } from "./browser";

async function main() {
  const browser = await launchBrowser();
  const page = await browser.newPage({ userAgent: UA, locale: "en-PH" });
  const hits: { url: string; status: number; body: string }[] = [];
  page.on("response", async (r) => {
    if (!r.url().includes("GetCinemaSchedules")) return;
    hits.push({ url: r.url(), status: r.status(), body: (await r.text()).slice(0, 300) });
  });
  await page.goto("https://fisherboxoffice.fishermall.com.ph/", {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await page.waitForTimeout(2000);
  console.log("page hits", hits);

  const viaRequest = await page.request.get(
    `https://fisherboxoffice.fishermall.com.ph/webservice/GetCinemaSchedules?_=${Date.now()}`,
  );
  console.log("page.request", viaRequest.status(), (await viaRequest.text()).slice(0, 300));

  const viaEval = await page.evaluate(async () => {
    const r = await fetch(`/webservice/GetCinemaSchedules?_=${Date.now()}`);
    return { status: r.status, text: (await r.text()).slice(0, 200) };
  });
  console.log("eval", viaEval);

  // jQuery like the site
  const viaJquery = await page.evaluate(async () => {
    const $ = (window as { jQuery?: (s: string) => { ajax: (o: unknown) => unknown } }).jQuery;
    if (!$) return { err: "no jquery" };
    return new Promise((resolve) => {
      // @ts-expect-error jquery in page
      window.jQuery.ajax({
        url: "/webservice/GetCinemaSchedules",
        type: "GET",
        dataType: "text",
        success: (data: string) => resolve({ status: 200, text: String(data).slice(0, 200) }),
        error: (xhr: { status: number; responseText: string }) =>
          resolve({ status: xhr.status, text: String(xhr.responseText).slice(0, 200) }),
      });
    });
  });
  console.log("jquery", viaJquery);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
