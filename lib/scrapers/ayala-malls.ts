import { SEED } from "@/lib/seed";
import { BaseScraper } from "./base";
import type { ScraperResult } from "./types";

export class AyalaMallsScraper extends BaseScraper {
  readonly source = "ayala-malls";

  async scrape(): Promise<ScraperResult> {
    try {
      const html = this.htmlFrom();
      const $ = this.loadHtml(html);
      const showtimes = $("showtime")
        .toArray()
        .map((el) => {
          const n = $(el);
          return {
            movieTitle: n.attr("movie") ?? "",
            cinemaName: n.attr("cinema") ?? "",
            chain: "Ayala Malls" as const,
            city: n.attr("city") ?? "metro-manila",
            mall: n.attr("mall") ?? "",
            screenType: (n.attr("format") ?? "2D") as "2D" | "3D" | "IMAX" | "Director's Club",
            startTime: n.attr("start") ?? "",
            price: n.attr("price") ? Number(n.attr("price")) : null,
            bookingUrl: n.attr("href") ?? "https://www.ayalaallaccess.com/",
          };
        })
        .filter((s) => s.movieTitle && s.startTime);
      return this.ok(showtimes);
    } catch (e) {
      return this.fail(e);
    }
  }

  private htmlFrom() {
    const ayala = SEED.cinemas.filter((c) => c.chain === "Ayala Malls");
    const rows = SEED.showtimes.filter((s) => ayala.some((c) => c.id === s.cinema_id));
    return `<listings>${rows
      .map((s) => {
        const cinema = ayala.find((c) => c.id === s.cinema_id)!;
        const movie = SEED.movies.find((m) => m.id === s.movie_id)!;
        return `<showtime movie="${this.attr(movie.title)}" cinema="${this.attr(cinema.name)}" city="${this.attr(cinema.city)}" mall="${this.attr(cinema.mall)}" format="${this.attr(s.screen_type)}" start="${this.attr(s.start_time)}" price="${this.attr(s.price)}" href="${this.attr(s.booking_direct_url)}"/>`;
      })
      .join("")}</listings>`;
  }
}
