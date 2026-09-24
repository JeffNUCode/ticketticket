import type {
  CinemaRow,
  LocalPromoRow,
  MovieReviewRow,
  MovieRow,
  ShowtimeRow,
} from "@/types/database";
import smCinemas from "@/data/sm-cinemas.json";
import partnerCinemas from "@/data/partner-cinemas.json";

function at(dayOffset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
}

export const SEED = {
  movies: [
    {
      id: "m-dune",
      title: "Dune: Part Two",
      original_title: "Dune: Part Two",
      slug: "dune-part-two",
      poster_url:
        "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=500&q=80",
      backdrop_url:
        "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1600&q=80",
      synopsis:
        "Paul Atreides unites with the Fremen to wage war against House Harkonnen and the Emperor, while facing a future only he can see.",
      duration_mins: 166,
      release_date: "2024-02-28",
      rating: "PG-13",
      genres: ["Sci-Fi", "Adventure"],
      trailer_youtube_id: "Way9Dexny3w",
      cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson"],
      created_at: "2024-02-01T00:00:00.000Z",
    },
    {
      id: "m-inside",
      title: "Inside Out 2",
      original_title: "Inside Out 2",
      slug: "inside-out-2",
      poster_url:
        "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=500&q=80",
      backdrop_url:
        "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1600&q=80",
      synopsis:
        "Riley's mind headquarters welcomes new emotions as she hits puberty — Anxiety, Envy, Ennui, and Embarrassment crash the party.",
      duration_mins: 96,
      release_date: "2024-06-14",
      rating: "PG",
      genres: ["Animation", "Family", "Comedy"],
      trailer_youtube_id: "LEjhY15eCx0",
      cast: ["Amy Poehler", "Maya Hawke", "Kensington Tallman"],
      created_at: "2024-05-01T00:00:00.000Z",
    },
    {
      id: "m-deadpool",
      title: "Deadpool & Wolverine",
      original_title: "Deadpool & Wolverine",
      slug: "deadpool-wolverine",
      poster_url:
        "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80",
      backdrop_url:
        "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1600&q=80",
      synopsis:
        "Wade Wilson tears through the MCU with a reluctant Wolverine in a profane, timeline-breaking buddy picture.",
      duration_mins: 128,
      release_date: "2024-07-26",
      rating: "R",
      genres: ["Action", "Comedy"],
      trailer_youtube_id: "73_1biulkYk",
      cast: ["Ryan Reynolds", "Hugh Jackman", "Emma Corrin"],
      created_at: "2024-06-01T00:00:00.000Z",
    },
    {
      id: "m-wicked",
      title: "Wicked",
      original_title: "Wicked",
      slug: "wicked",
      poster_url:
        "https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=500&q=80",
      backdrop_url:
        "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1600&q=80",
      synopsis:
        "Before Dorothy dropped in, two unlikely friends in Oz — Elphaba and Glinda — become the Wicked Witch and the Good Witch.",
      duration_mins: 160,
      release_date: "2024-11-22",
      rating: "PG",
      genres: ["Musical", "Fantasy"],
      trailer_youtube_id: "6C2lF7OHlmI",
      cast: ["Cynthia Erivo", "Ariana Grande", "Jonathan Bailey"],
      created_at: "2024-09-01T00:00:00.000Z",
    },
    {
      id: "m-flow",
      title: "Flow",
      original_title: "Straume",
      slug: "flow",
      poster_url:
        "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=500&q=80",
      backdrop_url:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
      synopsis:
        "A cat, a capybara, and a handful of animals navigate a flooded, wordless world — Oscar-winning animation from Latvia.",
      duration_mins: 85,
      release_date: "2024-08-30",
      rating: "PG",
      genres: ["Animation", "Adventure"],
      trailer_youtube_id: "ZgP2KqYjKkE",
      cast: [],
      created_at: "2024-08-01T00:00:00.000Z",
    },
    {
      id: "m-challengers",
      title: "Challengers",
      original_title: "Challengers",
      slug: "challengers",
      poster_url:
        "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=500&q=80",
      backdrop_url:
        "https://images.unsplash.com/photo-1489944440615-453fc71b44b9?auto=format&fit=crop&w=1600&q=80",
      synopsis:
        "A tennis prodigy, her husband-coach, and an old rival collide over one charged match — Zendaya, Guadagnino, a score that slaps.",
      duration_mins: 131,
      release_date: "2024-04-26",
      rating: "R",
      genres: ["Drama", "Romance"],
      trailer_youtube_id: "cr8lUwsTzCk",
      cast: ["Zendaya", "Josh O'Connor", "Mike Faist"],
      created_at: "2024-03-01T00:00:00.000Z",
    },
  ] satisfies MovieRow[],

  cinemas: [
    ...(smCinemas as CinemaRow[]),
    ...(partnerCinemas as CinemaRow[]),
  ] satisfies CinemaRow[],

  showtimes: [] as ShowtimeRow[],
  promos: [
    {
      id: "p-1",
      cinema_id: "c-sm-mega",
      business_name: "Yakimix Megamall",
      promo_text: "Show this screen at Yakimix inside SM Megamall for 10% off your buffet.",
      offer_code: "TICKET10",
      link: "https://www.smcinema.com/",
      expires_at: at(14, 23, 59),
    },
    {
      id: "p-2",
      cinema_id: "c-sm-moa",
      business_name: "Starbucks MOA",
      promo_text: "Free tall espresso drink with any IMAX stub the same day.",
      offer_code: "IMAXCAFE",
      link: null,
      expires_at: at(21, 23, 59),
    },
    {
      id: "p-3",
      cinema_id: "c-ayala-gc",
      business_name: "Wildflour Greenbelt",
      promo_text: "Director's Club ticket holders get complimentary dessert with dinner.",
      offer_code: null,
      link: "https://www.ayalaallaccess.com/",
      expires_at: at(10, 23, 59),
    },
    {
      id: "p-4",
      cinema_id: "c-sm-cebu",
      business_name: "Kuya J Cebu",
      promo_text: "Show your SM Cebu stub for free extra rice on any silog.",
      offer_code: "SILOG",
      link: null,
      expires_at: at(30, 23, 59),
    },
  ] satisfies LocalPromoRow[],
  reviews: [
    {
      id: "r-1",
      movie_id: "m-dune",
      user_id: "seed-user",
      rating: 5,
      body: "IMAX at MOA is the way. The worm sequence still slaps on a third watch.",
      created_at: at(-2, 20),
    },
    {
      id: "r-2",
      movie_id: "m-wicked",
      user_id: "seed-user",
      rating: 4,
      body: "Greenbelt crowd lost it at Defying Gravity. Bring tissues, skip the back row.",
      created_at: at(-1, 21),
    },
  ] satisfies MovieReviewRow[],
};

const SLOTS: { movie: string; cinema: string; format: ShowtimeRow["screen_type"]; day: number; hour: number; price: number }[] = [
  { movie: "m-dune", cinema: "c-sm-moa", format: "IMAX", day: 0, hour: 13, price: 520 },
  { movie: "m-dune", cinema: "c-sm-moa", format: "IMAX", day: 0, hour: 19, price: 560 },
  { movie: "m-dune", cinema: "c-sm-mega", format: "2D", day: 0, hour: 16, price: 320 },
  { movie: "m-dune", cinema: "c-ayala-gc", format: "Director's Club", day: 0, hour: 20, price: 650 },
  { movie: "m-inside", cinema: "c-sm-mega", format: "2D", day: 0, hour: 14, price: 280 },
  { movie: "m-inside", cinema: "c-rob-galleria", format: "3D", day: 0, hour: 15, price: 350 },
  { movie: "m-deadpool", cinema: "c-mega-u", format: "2D", day: 0, hour: 18, price: 380 },
  { movie: "m-deadpool", cinema: "c-ayala-bgc", format: "2D", day: 0, hour: 21, price: 400 },
  { movie: "m-wicked", cinema: "c-ayala-gc", format: "2D", day: 0, hour: 17, price: 360 },
  { movie: "m-wicked", cinema: "c-sm-mega", format: "2D", day: 0, hour: 19, price: 330 },
  { movie: "m-flow", cinema: "c-ayala-gc", format: "2D", day: 0, hour: 13, price: 300 },
  { movie: "m-challengers", cinema: "c-mega-u", format: "Director's Club", day: 0, hour: 21, price: 620 },
  { movie: "m-dune", cinema: "c-sm-cebu", format: "IMAX", day: 0, hour: 18, price: 480 },
  { movie: "m-wicked", cinema: "c-ayala-cebu", format: "2D", day: 0, hour: 16, price: 310 },
  { movie: "m-inside", cinema: "c-sm-davao", format: "2D", day: 0, hour: 15, price: 270 },
  { movie: "m-deadpool", cinema: "c-sm-mega", format: "2D", day: 1, hour: 20, price: 340 },
  { movie: "m-wicked", cinema: "c-sm-moa", format: "IMAX", day: 1, hour: 16, price: 540 },
  { movie: "m-flow", cinema: "c-rob-galleria", format: "2D", day: 1, hour: 14, price: 280 },
  { movie: "m-dune", cinema: "c-sm-mega", format: "2D", day: 1, hour: 21, price: 320 },
];

SEED.showtimes = SLOTS.flatMap((s, i) => {
  const cinema = SEED.cinemas.find((c) => c.id === s.cinema);
  if (!cinema) return [];
  return [
    {
      id: `st-${i + 1}`,
      movie_id: s.movie,
      cinema_id: s.cinema,
      screen_type: s.format,
      start_time: at(s.day, s.hour),
      price: s.price,
      booking_direct_url: `${cinema.website_booking_url}?ref=gosee&movie=${s.movie}`,
      updated_at: new Date().toISOString(),
    },
  ];
});
