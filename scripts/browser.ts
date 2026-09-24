import { chromium, type Browser } from "playwright-core";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/**
 * Drives a browser already on the machine (Windows always has Edge), so there is no
 * `playwright install` step and no ~140MB download per Playwright release.
 */
export async function launchBrowser(): Promise<Browser> {
  if (process.env.CHROME_PATH) {
    return chromium.launch({ executablePath: process.env.CHROME_PATH });
  }
  for (const channel of ["chrome", "msedge", "chromium"] as const) {
    try {
      return await chromium.launch({ channel });
    } catch {
      /* not installed — try the next one */
    }
  }
  throw new Error("no Chrome, Edge or Chromium found — install one, or set CHROME_PATH");
}
