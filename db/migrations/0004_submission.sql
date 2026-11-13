-- Claim sources beyond the README (F10) and the tracks a team is entering (F16).
-- Both are the team's own untrusted input, stored for the scan and never shown publicly.

alter table public.sessions add column if not exists submission jsonb;
alter table public.sessions add column if not exists tracks jsonb;
