export type ScreenType = "2D" | "3D" | "IMAX" | "Director's Club";

export type CinemaChain =
  | "SM Cinema"
  | "Ayala Malls"
  | "Robinsons"
  | "Megaworld"
  | "Vista Cinemas"
  | "Gateway Cineplex"
  | "Power Plant"
  | "Fisher Mall";

export type CitySlug =
  | "metro-manila"
  | "cavite"
  | "north-luzon"
  | "south-luzon"
  | "cebu"
  | "visayas"
  | "davao"
  | "mindanao";

/** Picker / URL value — includes nationwide "all". Inventory rows stay on CitySlug. */
export type LocationFilterId = "all" | CitySlug;

export interface UserRow {
  id: string;
  email: string;
  preferred_location: CitySlug | null;
  created_at: string;
}

export interface MovieRow {
  id: string;
  title: string;
  original_title: string | null;
  slug: string;
  poster_url: string;
  backdrop_url: string;
  synopsis: string;
  duration_mins: number;
  release_date: string;
  rating: string;
  genres: string[];
  trailer_youtube_id: string | null;
  cast: string[];
  created_at: string;
}

export interface CinemaRow {
  id: string;
  name: string;
  chain: CinemaChain;
  city: CitySlug;
  mall: string;
  address: string;
  latitude: number;
  longitude: number;
  website_booking_url: string;
}

export interface ShowtimeRow {
  id: string;
  movie_id: string;
  cinema_id: string;
  screen_type: ScreenType;
  start_time: string;
  price: number | null;
  /**
   * The cinema's own booking page — NOT a per-showtime deep link. No PH chain exposes one,
   * so the UI must say "continue on their site", never "open this showtime".
   */
  booking_direct_url: string;
  updated_at: string;
}

export interface LocalPromoRow {
  id: string;
  cinema_id: string;
  business_name: string;
  promo_text: string;
  offer_code: string | null;
  link: string | null;
  expires_at: string;
}

export interface WatchlistAlertRow {
  id: string;
  user_id: string;
  movie_id: string;
  screen_type: ScreenType | null;
  created_at: string;
}

export interface MovieReviewRow {
  id: string;
  movie_id: string;
  user_id: string;
  rating: number;
  body: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      users: { Row: UserRow; Insert: Partial<UserRow> & { id: string; email: string }; Update: Partial<UserRow> };
      movies: { Row: MovieRow; Insert: Partial<MovieRow> & { title: string; slug: string }; Update: Partial<MovieRow> };
      cinemas: { Row: CinemaRow; Insert: Partial<CinemaRow> & { name: string; chain: CinemaChain; city: CitySlug }; Update: Partial<CinemaRow> };
      showtimes: { Row: ShowtimeRow; Insert: Partial<ShowtimeRow> & { movie_id: string; cinema_id: string; start_time: string }; Update: Partial<ShowtimeRow> };
      local_promos: { Row: LocalPromoRow; Insert: Partial<LocalPromoRow> & { cinema_id: string; business_name: string; promo_text: string }; Update: Partial<LocalPromoRow> };
      watchlist_alerts: { Row: WatchlistAlertRow; Insert: Partial<WatchlistAlertRow> & { user_id: string; movie_id: string }; Update: Partial<WatchlistAlertRow> };
      movie_reviews: { Row: MovieReviewRow; Insert: Partial<MovieReviewRow> & { movie_id: string; user_id: string; rating: number }; Update: Partial<MovieReviewRow> };
    };
  };
}
