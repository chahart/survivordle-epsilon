-- Sandwich global stats for both shows. Totals = daily + unlimited; easiest/hardest = daily + unlimited plays
-- of each puzzle, ranked by % solved on the first guess (min 30 plays, so small samples can't win). Run in the Supabase SQL Editor.
create or replace function public.get_sandwich_global_stats(p_show text)
returns json
language sql
security definer
set statement_timeout = '30s'
as $$
  with base as materialized (
    select puzzle, guesses, won, mode from sandwich_events
      where p_show = 'sv' and mode in ('sandwich_daily', 'sandwich_unlimited')
    union all
    select puzzle, guesses, won, mode from bb_sandwich_events
      where p_show = 'bb' and mode in ('bb_sandwich_daily', 'bb_sandwich_unlimited')
  ),
  per_puzzle as (
    select puzzle, round(100.0 * count(*) filter (where won and guesses = 1) / count(*)) as avg_score, count(*) as plays
    from base where puzzle is not null
    group by puzzle having count(*) >= 30
  )
  select json_build_object(
    'total_games', count(*),
    'total_wins', count(*) filter (where won),
    'avg_guesses', round(avg(guesses) filter (where won)::numeric, 2),
    'dist', (select coalesce(json_object_agg(guesses, cnt), '{}'::json)
             from (select guesses, count(*) as cnt from base where won and guesses between 1 and 4 group by guesses) d),
    'easiest', (select json_agg(r) from (select puzzle, avg_score from per_puzzle order by avg_score desc, plays desc, puzzle limit 3) r),
    'hardest', (select json_agg(r) from (select puzzle, avg_score from per_puzzle order by avg_score asc, plays desc, puzzle limit 3) r)
  )
  from base;
$$;
grant execute on function public.get_sandwich_global_stats(text) to anon;

create index if not exists sandwich_events_mode_idx on sandwich_events (mode);
create index if not exists bb_sandwich_events_mode_idx on bb_sandwich_events (mode);
