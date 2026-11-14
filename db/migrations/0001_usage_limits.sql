-- Usage log, daily caps measured from it, and the columns the funnel reads.
-- Run in order with: psql "$DATABASE_URL" -f db/migrations/0001_usage_limits.sql

-- One row per model call (model set) or timed step (model null). Spend limits and
-- `npm run stats` read from here; nothing in it identifies a person.
create table if not exists public.session_usage (
  id bigint generated always as identity primary key,
  session_id text references public.sessions (id) on delete set null,
  step text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  usd numeric(12, 8) not null default 0,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists session_usage_created_idx on public.session_usage (created_at);
create index if not exists session_usage_session_idx on public.session_usage (session_id);

alter table public.session_usage enable row level security;
revoke all on public.session_usage from anon, authenticated;

-- Event mode (F9), sharing (F6) and the public board (F25). Defaults keep every existing
-- row private, except finished reviews, which were public by link before this change.
alter table public.sessions add column if not exists event_slug text;
alter table public.sessions add column if not exists shareable boolean not null default false;
alter table public.sessions add column if not exists listed boolean not null default false;
alter table public.sessions add column if not exists hidden_at timestamptz;

update public.sessions set shareable = true where act in ('verdict', 'share') and panel is not null and shareable = false;

-- The caps read sessions by created_at and by (ip_hash, created_at). The live database already
-- has both indexes (sessions_created_at_idx, sessions_ip_hash_created_at_idx), so none are added.

-- Model spend so far in the current UTC day.
create or replace function public.daily_spend_usd()
returns numeric
language sql
stable
as $$
  select coalesce(sum(usd), 0)
  from public.session_usage
  where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;

-- Checks the caps and, when p_id is given and every cap has room, inserts the session, all
-- under one advisory lock so two requests can't both take the last slot. Without p_id it
-- only checks. Mirrors checkCaps in lib/limits.ts: spend first, then the day, then the visitor.
create or replace function public.reserve_session_v2(
  p_ip_hash text,
  p_user_limit integer,
  p_day_limit integer,
  p_spend_limit numeric,
  p_id text default null,
  p_repo_url text default null,
  p_repo text default null,
  p_latest_sha text default null,
  p_owner_hash text default null,
  p_act text default 'scan',
  p_event_slug text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  user_count integer;
  day_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('reserve_session'));

  if public.daily_spend_usd() >= p_spend_limit then
    return 'spendCap';
  end if;

  select count(*) into day_count from public.sessions where created_at >= day_start;
  if day_count >= p_day_limit then
    return 'dailyCap';
  end if;

  select count(*) into user_count from public.sessions where ip_hash = p_ip_hash and created_at >= day_start;
  if user_count >= p_user_limit then
    return 'rateLimited';
  end if;

  if p_id is not null then
    -- The same starting state as newSession in lib/session.ts.
    insert into public.sessions (id, repo_url, repo, latest_sha, owner_hash, ip_hash, act, event_slug, questions, answers, events, files, sources)
    values (p_id, p_repo_url, p_repo, p_latest_sha, p_owner_hash, p_ip_hash, p_act, p_event_slug, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb);
  end if;

  return 'ok';
end;
$$;

revoke all on function public.reserve_session_v2 from public, anon, authenticated;
revoke all on function public.daily_spend_usd from public, anon, authenticated;
