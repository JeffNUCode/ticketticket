/** ponytail: Puppeteer is the upgrade path for JS-rendered cinema sites; Cheerio + mocks keep the pipeline testable without Chromium. */
import axios, { type AxiosInstance } from "axios";
import * as cheerio from "cheerio";
import { rotateUserAgent, type ScraperResult } from "./types";

export abstract class BaseScraper {
  abstract readonly source: string;

  protected client(): AxiosInstance {
    return axios.create({
      timeout: 12_000,
      headers: {
        "User-Agent": rotateUserAgent(),
        Accept: "text/html,application/xhtml+xml",
      },
      validateStatus: (s) => s < 500,
    });
  }

  protected loadHtml(html: string) {
    return cheerio.load(html);
  }

  abstract scrape(): Promise<ScraperResult>;

  protected ok(showtimes: ScraperResult["showtimes"], errors: string[] = []): ScraperResult {
    return {
      source: this.source,
      fetchedAt: new Date().toISOString(),
      showtimes,
      errors,
    };
  }

  protected fail(error: unknown): ScraperResult {
    const message = error instanceof Error ? error.message : String(error);
    return this.ok([], [message]);
  }

  protected attr(value: string | number | null | undefined) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }
}
