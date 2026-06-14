begin;

-- ═══════════════════════════════════════════════════════════════════
-- FeedMe relay cache
--
-- WHY: FeedMe's query engine (query-engine.feedmeapi.com) sits behind
-- Cloudflare, which 403-blocks requests from datacenter IPs (Vercel). The
-- restaurant's residential/broadband IP is NOT blocked. So a relay job runs on a
-- machine with such an IP (Mac now, an always-on restaurant device later),
-- fetches FeedMe, and writes the parsed result here. The Vercel app reads from
-- this table instead of calling FeedMe directly.
--
-- One row per "kind": 'daily' | 'mtd' | 'week'. payload is the exact JSON the
-- live getters return, so the app's downstream compute is unchanged.
-- Additive · idempotent.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.feedme_relay_cache (
  kind        text primary key check (kind in ('daily', 'mtd', 'week')),
  payload     jsonb not null,
  fetched_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The app reads via the service-role client (admin), which bypasses RLS. Enable
-- RLS with no policies so anon/authenticated clients cannot read or write it.
alter table public.feedme_relay_cache enable row level security;

commit;
