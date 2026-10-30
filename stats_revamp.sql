-- Stats revamp. Run once in the Supabase SQL Editor.
--
-- Why global stats were empty:
--  * get_global_stats scanned solve_events ~5x per call; at ~167k rows that exceeds the
--    anon role's statement timeout, so the request fails and the page shows nothing.
--    Rewritten to scan once (plus a single indexed-friendly pass), and given its own timeout.
--  * get_bb_* functions were not SECURITY DEFINER, so anon (no SELECT policy on bb_*
--    tables) saw zero rows. Now SECURITY DEFINER like the Survivor ones.
--  * BB timestamp is a text column like '2026-10-29 03:45pm' (client-local), so BB daily
--    uses left(timestamp, 10)::date instead of casting the whole string.

-- ── Survivor global (single scan) ────────────────────────────────────────────
create or replace function public.get_global_stats()
returns json
language sql
security definer
set statement_timeout = '30s'
as $$
  with base as (
    select won, guesses, mode, first_guess from solve_events
  )
  select json_build_object(
    'total_games', count(*),
    'total_wins', count(*) filter (where won),
    'total_guesses_approx', coalesce(sum(guesses) filter (where won), 0),
    'unlimited_total', count(*) filter (where mode in ('unlimited', 'unlimited-giveup')),
    'daily_total', count(*) filter (where mode in ('daily', 'daily-giveup')),
    'dist', (
      select coalesce(json_object_agg(guesses, cnt), '{}'::json)
      from (select guesses, count(*) as cnt from base
            where won and guesses between 1 and 8 group by guesses) d
    ),
    'top_first_guesses', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from (select first_guess, count(*) as count from base
            where first_guess is not null
            group by first_guess order by count desc limit 5) t
    )
  )
  from base;
$$;

-- ── BB global ────────────────────────────────────────────────────────────────
create or replace function public.get_bb_global_stats()
returns json
language sql
security definer
set statement_timeout = '30s'
as $$
  with base as (
    select won, guesses, mode, first_guess from bb_solve_events
  )
  select json_build_object(
    'total_games', count(*),
    'total_wins', count(*) filter (where won),
    'total_guesses_approx', coalesce(sum(guesses) filter (where won), 0),
    'unlimited_total', count(*) filter (where mode in ('bb_unlimited', 'bb_unlimited-giveup')),
    'daily_total', count(*) filter (where mode in ('bb', 'bb-giveup')),
    'dist', (
      select coalesce(json_object_agg(guesses, cnt), '{}'::json)
      from (select guesses, count(*) as cnt from base
            where won and guesses between 1 and 8 group by guesses) d
    ),
    'top_first_guesses', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from (select first_guess, count(*) as count from base
            where first_guess is not null
            group by first_guess order by count desc limit 5) t
    )
  )
  from base;
$$;

-- ── BB daily (same shape as get_daily_stats: one row per day = most-played puzzle) ──
create or replace function public.get_bb_daily_stats()
returns json
language sql
security definer
set statement_timeout = '30s'
as $$
  with ev as (
    select puzzle, guesses, left(timestamp, 10)::date as day
    from bb_solve_events
    where mode = 'bb' and won
      and timestamp ~ '^\d{4}-\d{2}-\d{2}'
      and left(timestamp, 10)::date >= current_date - 8
  ),
  agg as (
    select day, puzzle,
           round(avg(guesses)::numeric, 2) as avg_guesses,
           count(*) as solve_count,
           row_number() over (partition by day order by count(*) desc) as rn
    from ev group by day, puzzle
  ),
  top as (select * from agg where rn = 1)
  select json_build_object(
    'today', (select json_build_object('puzzle', puzzle, 'avg_guesses', avg_guesses, 'solve_count', solve_count)
              from top order by day desc limit 1),
    'last_seven', (select coalesce(json_agg(row_to_json(t)), '[]'::json)
                   from (select day, puzzle, avg_guesses, solve_count from top order by day desc limit 7) t)
  );
$$;

-- ── BB recall global (mirror of get_recall_global_stats) ─────────────────────
create or replace function public.get_bb_recall_global_stats()
returns json
language sql
security definer
set statement_timeout = '30s'
as $$
  with base as (
    select * from bb_recall_events where mode = 'bb_recall_unlimited'
  ),
  per_puzzle as (
    select puzzle, round(avg(score)) as avg_score, count(*) as plays
    from base where puzzle is not null
    group by puzzle having count(*) >= 10
  )
  select json_build_object(
    'total_plays',     (select count(*) from base),
    'unlimited_plays', (select count(*) from base),
    'avg_score',       round((select avg(score) from base)),
    'avg_gpa', round(avg(case grade
        when 'A+' then 4.0 when 'A' then 4.0 when 'A-' then 3.66
        when 'B+' then 3.33 when 'B' then 3.0 when 'B-' then 2.66
        when 'C+' then 2.33 when 'C' then 2.0 when 'C-' then 1.66
        when 'D+' then 1.33 when 'D' then 1.0 when 'D-' then 0.66
        when 'F' then 0.0 else null end)::numeric, 2),
    'grade_dist', json_build_object(
      'A', count(*) filter (where grade in ('A+','A','A-')),
      'B', count(*) filter (where grade in ('B+','B','B-')),
      'C', count(*) filter (where grade in ('C+','C','C-')),
      'D', count(*) filter (where grade in ('D+','D','D-')),
      'F', count(*) filter (where grade = 'F')),
    'easiest', (select json_agg(r) from (select puzzle, avg_score from per_puzzle order by avg_score desc limit 5) r),
    'hardest', (select json_agg(r) from (select puzzle, avg_score from per_puzzle order by avg_score asc limit 5) r)
  )
  from base;
$$;

grant execute on function public.get_global_stats(), public.get_bb_global_stats(),
  public.get_bb_daily_stats(), public.get_bb_recall_global_stats() to anon;

-- Indexes last, so a slow build can never block the functions above.
create index if not exists solve_events_mode_created_idx on solve_events (mode, created_at);
create index if not exists bb_solve_events_mode_idx on bb_solve_events (mode);

-- Verify (each should return JSON quickly):
-- select get_global_stats(); select get_bb_global_stats();
-- select get_bb_daily_stats(); select get_bb_recall_global_stats();
