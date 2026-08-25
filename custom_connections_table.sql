-- Creates the table backing Connections' Custom puzzle sharing feature.
-- A puzzle built in the app is inserted here once, and shared via a short
-- code (e.g. survivordle.com/connections/custom/aB3xK9) instead of a long
-- encoded link. Anyone with the code can read that one row to play it;
-- nothing else is exposed.
--
-- Run this in the Supabase SQL Editor.

create table if not exists custom_connections_puzzles (
  code text primary key,
  title text,
  groups jsonb not null,
  created_at timestamptz not null default now()
);

alter table custom_connections_puzzles enable row level security;

-- Anyone can create a puzzle (same trust model as this site's existing
-- anon-insert event tables — see bb_events_rls_fix.sql).
create policy "Allow anon insert" on custom_connections_puzzles
  for insert to anon with check (true);

-- Anyone can read a puzzle by its code to play it. There's no listing
-- endpoint in the app, but note this table is technically enumerable by
-- anyone with direct API access (same as any anon-readable Supabase table).
create policy "Allow anon select" on custom_connections_puzzles
  for select to anon using (true);

-- Verify with (should return 201, not 401/42501):
-- insert into custom_connections_puzzles (code, title, groups)
-- values ('rlstest', 'RLS TEST - delete me', '[]'::jsonb)
-- returning *;
-- Then delete the test row: delete from custom_connections_puzzles where code = 'rlstest';
