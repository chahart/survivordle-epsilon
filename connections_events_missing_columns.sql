-- Catches up connections_events on two columns that were added to the app's
-- code/docs but never actually run against the live table:
--   used_hint   - true if the "reveal category" hint was used at all that game
--   puzzle_type - 'main' | 'custom' | 'featured' (which kind of puzzle this solve is for)
--   custom_code - links back to custom_connections_puzzles.code for
--                 'custom'/'featured' rows; null for 'main'
--
-- Existing rows all predate these features, so they backfill safely as
-- used_hint = false and puzzle_type = 'main' via the column defaults.
--
-- Safe to run more than once.
--
-- Run this in the Supabase SQL Editor.

alter table connections_events
  add column if not exists used_hint boolean not null default false;

alter table connections_events
  add column if not exists puzzle_type text not null default 'main';

alter table connections_events
  add column if not exists custom_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'connections_events_puzzle_type_check'
  ) then
    alter table connections_events
      add constraint connections_events_puzzle_type_check
      check (puzzle_type in ('main', 'custom', 'featured'));
  end if;
end $$;

-- Verify with (should return 201, not 401/42501):
-- insert into connections_events (week_num, won, mistakes, solve_order, used_hint, puzzle_type, custom_code, timestamp)
-- values (0, true, 1, '[1,2,3,4]'::jsonb, false, 'custom', 'testcode', now()::text)
-- returning *;
-- Then delete the test row: delete from connections_events where week_num = 0;
