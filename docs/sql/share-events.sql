-- Share events: what people do on the share screen, for the stats. No IPs, no user data:
-- just which review, what they did, and which image format.
-- Run once against the database (psql "$DATABASE_URL" -f docs/sql/share-events.sql).

create table if not exists public.share_events (
  id bigint generated always as identity primary key,
  session_id text not null references public.sessions (id) on delete cascade,
  kind text not null check (kind in ('share_image', 'x_clicked', 'linkedin_clicked', 'download', 'caption_copied')),
  format text check (format in ('landscape', 'portrait', 'story')),
  created_at timestamptz not null default now(),
  -- A download always says which image.
  check (kind <> 'download' or format is not null)
);

create index if not exists share_events_session_idx on public.share_events (session_id);
create index if not exists share_events_created_idx on public.share_events (created_at);

-- Same rules as every other table: RLS on, no policies, no grants. Only the service role
-- (the app's server) reads or writes it.
alter table public.share_events enable row level security;
revoke all on public.share_events from anon, authenticated;
