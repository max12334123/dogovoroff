alter table public.profiles
  add column if not exists notifications_read_at timestamptz;

comment on column public.profiles.notifications_read_at is
  'User-controlled read marker for privacy-safe notifications derived from accessible matter activity.';
