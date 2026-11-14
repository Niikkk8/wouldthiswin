-- The CLI's public scans (F24): deterministic checks and extracted claims for a public repo,
-- cached by repo, commit and scan version. Only public findings are stored. ip_hash is the
-- salted hash used for the 3-a-day limit, never the address.

create table if not exists public.public_scans (
  id text primary key,
  repo text not null,
  sha text not null,
  scan_version integer not null,
  ip_hash text not null,
  report jsonb not null,
  usd numeric(12, 8) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists public_scans_lookup_idx on public.public_scans (repo, sha, scan_version);
create index if not exists public_scans_ip_idx on public.public_scans (ip_hash, created_at);

alter table public.public_scans enable row level security;
revoke all on public.public_scans from anon, authenticated;
