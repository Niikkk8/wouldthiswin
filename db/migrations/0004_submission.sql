-- What the team adds beyond the repo: claim sources (a Devpost page, pasted submission text),
-- the event window and the sponsor tracks it's entering. Untrusted input, stored for the scan
-- and never shown publicly.

alter table public.sessions add column if not exists submission jsonb;
