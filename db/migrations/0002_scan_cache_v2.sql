-- Scan cache keyed by repo, head commit and scan version (lib/scan-cache.ts). Holds findings
-- and the paths of the files read, never their contents. Rows go after 7 days (retention job).

create table if not exists public.scan_cache_v2 (
  owner text not null,
  repo text not null,
  sha text not null check (sha ~ '^[0-9a-f]{40}$'),
  scan_version integer not null,
  scan jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner, repo, sha, scan_version)
);

create index if not exists scan_cache_v2_created_idx on public.scan_cache_v2 (created_at);

alter table public.scan_cache_v2 enable row level security;
revoke all on public.scan_cache_v2 from anon, authenticated;
