-- GoSee! schema: movies, cinemas, showtimes, promos, watchlist alerts.
-- ponytail: seed path works without this DB; point NEXT_PUBLIC_SUPABASE_* at a project and run this migration.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  preferred_location text,
  created_at timestamptz not null default now()
);

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  original_title text,
  slug text not null unique,
  poster_url text not null default '',
  backdrop_url text not null default '',
  synopsis text not null default '',
  duration_mins integer not null default 0,
  release_date date,
  rating text not null default 'PG',
  genres text[] not null default '{}',
  trailer_youtube_id text,
  cast text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.cinemas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chain text not null,
  city text not null,
  mall text not null default '',
  address text not null default '',
  latitude double precision,
  longitude double precision,
  website_booking_url text not null default ''
);

create table if not exists public.showtimes (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies (id) on delete cascade,
  cinema_id uuid not null references public.cinemas (id) on delete cascade,
  screen_type text not null default '2D',
  start_time timestamptz not null,
  price numeric,
  booking_direct_url text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists showtimes_start_time_idx on public.showtimes (start_time);
create index if not exists showtimes_cinema_idx on public.showtimes (cinema_id);
create index if not exists showtimes_movie_idx on public.showtimes (movie_id);

create table if not exists public.local_promos (
  id uuid primary key default gen_random_uuid(),
  cinema_id uuid not null references public.cinemas (id) on delete cascade,
  business_name text not null,
  promo_text text not null,
  offer_code text,
  link text,
  expires_at timestamptz not null
);

create table if not exists public.watchlist_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  movie_id uuid not null references public.movies (id) on delete cascade,
  screen_type text,
  created_at timestamptz not null default now(),
  unique (user_id, movie_id, screen_type)
);

create table if not exists public.movie_reviews (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null default '',
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.movies enable row level security;
alter table public.cinemas enable row level security;
alter table public.showtimes enable row level security;
alter table public.local_promos enable row level security;
alter table public.watchlist_alerts enable row level security;
alter table public.movie_reviews enable row level security;

create policy "movies_read" on public.movies for select using (true);
create policy "cinemas_read" on public.cinemas for select using (true);
create policy "showtimes_read" on public.showtimes for select using (true);
create policy "promos_read" on public.local_promos for select using (true);
create policy "reviews_read" on public.movie_reviews for select using (true);

create policy "users_self" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "watchlist_self" on public.watchlist_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reviews_insert_self" on public.movie_reviews
  for insert with check (auth.uid() = user_id);

create policy "reviews_update_self" on public.movie_reviews
  for update using (auth.uid() = user_id);

-- Writes for catalog tables: service role only (no policy = denied for anon/auth).
