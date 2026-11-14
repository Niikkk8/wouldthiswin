-- "Add your hackathon" requests from /organizers (F26), for Niket to review and turn into
-- presets. ip_hash is the salted hash used to limit requests, never the address.

create table if not exists public.organizer_requests (
  id bigint generated always as identity primary key,
  name text not null,
  url text not null,
  starts_at text,
  ends_at text,
  rubric text,
  tracks text,
  contact text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists organizer_requests_ip_idx on public.organizer_requests (ip_hash, created_at);
create index if not exists sessions_event_idx on public.sessions (event_slug) where event_slug is not null;

alter table public.organizer_requests enable row level security;
revoke all on public.organizer_requests from anon, authenticated;
