-- Connections global stats (Survivordle only). Reads the existing connections_events and
-- custom_connections_puzzles tables; no new logging needed.
-- Weekly section: 'main' puzzles. Custom section: custom/community games.
-- mistakes: 0-3 on a win, 4 on a loss. solve_order: group difficulty in the order solved
-- (1 green, 2 orange, 3 purple, 4 red). first_dist counts which color was found first.
-- Only approved/featured community puzzles are ever named, so private puzzle titles stay private.
-- Safe to run more than once. Run in the Supabase SQL Editor.
create or replace function public.get_connections_global_stats()
returns json
language sql
security definer
set search_path = public
set statement_timeout = '30s'
as $$
  with base as materialized (
    select week_num, won, mistakes, used_hint, solve_order
    from connections_events
    where puzzle_type = 'main' and week_num > 0
  ),
  per_puzzle as (
    select week_num, count(*) as plays, round(100.0 * count(*) filter (where won) / count(*)) as win_pct
    from base group by week_num
  ),
  custom_base as materialized (
    select custom_code, won from connections_events where puzzle_type in ('custom', 'featured')
  ),
  community as (
    select p.code, p.title, p.author, count(*) as plays,
           round(100.0 * count(*) filter (where c.won) / count(*)) as win_pct
    from custom_base c join custom_connections_puzzles p on p.code = c.custom_code
    where p.status in ('approved', 'featured')
    group by p.code, p.title, p.author
  )
  select json_build_object(
    'total_games', count(*),
    'total_wins',  count(*) filter (where won),
    'perfect',     count(*) filter (where won and mistakes = 0),
    'hint_pct',    round(100.0 * count(*) filter (where used_hint) / nullif(count(*), 0)),
    'first_dist', (select coalesce(json_object_agg(first, cnt), '{}'::json)
                   from (select solve_order->>0 as first, count(*) as cnt from base
                         where jsonb_array_length(solve_order) > 0 group by 1) f),
    'mistake_dist', (select coalesce(json_object_agg(mistakes, cnt), '{}'::json)
                     from (select mistakes, count(*) as cnt from base where won group by mistakes) d),
    'puzzles', (select coalesce(json_agg(p order by p.week_num), '[]'::json) from per_puzzle p),
    'custom', json_build_object(
      'created',   (select count(*) from custom_connections_puzzles),
      'community', (select count(*) from custom_connections_puzzles where status in ('approved', 'featured')),
      'games',     (select count(*) from custom_base),
      'community_games', (select coalesce(sum(plays), 0) from community),
      'wins',      (select count(*) from custom_base where won),
      'most_played', (select coalesce(json_agg(r), '[]'::json) from
                       (select code, title, author, plays from community order by plays desc, code limit 3) r),
      'hardest',     (select coalesce(json_agg(r), '[]'::json) from
                       (select code, title, author, win_pct, plays from community where plays >= 50
                        order by win_pct asc, plays desc, code limit 3) r)
    )
  )
  from base;
$$;
grant execute on function public.get_connections_global_stats() to anon;

-- Verify: select get_connections_global_stats();
