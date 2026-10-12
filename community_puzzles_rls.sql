-- Community puzzles, step 2 of 2: lock down reads/writes.
-- Run this in the Supabase SQL Editor AFTER the new app code is deployed
-- (the old code reads rows directly, which this step stops allowing for
-- private/unapproved puzzles).
--
-- After this:
--   * Anyone can still PLAY any puzzle by code (via get_custom_puzzle, created
--     in community_puzzles_columns.sql).
--   * The public table listing only exposes approved/featured puzzles.
--   * New puzzles can only be inserted as 'private' or 'submitted' — nobody
--     can self-approve or self-feature.
--   * No anon updates or deletes (you change status in the dashboard, which
--     bypasses RLS).

drop policy if exists "Allow anon select" on custom_connections_puzzles;
drop policy if exists "Allow anon insert" on custom_connections_puzzles;

create policy "Anon read listed puzzles" on custom_connections_puzzles
  for select to anon
  using (status in ('approved', 'featured'));

create policy "Anon insert private or submitted" on custom_connections_puzzles
  for insert to anon
  with check (status in ('private', 'submitted'));

-- Verify (as anon via the app): creating a puzzle with status 'featured'
-- should fail with 401/42501, and a private puzzle's link should still load.
