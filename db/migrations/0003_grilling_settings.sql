-- Fair timing: per-person settings (extended time) and the copy each session takes of them.

alter table public.sessions add column if not exists settings jsonb;

create table if not exists public.owner_prefs (
  owner_hash text primary key check (owner_hash ~ '^[0-9a-f]{64}$'),
  extended_time boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.owner_prefs enable row level security;
revoke all on public.owner_prefs from anon, authenticated;
