-- Recall global stats: single pass (the old Survivor version times out at anon's 3s limit).
-- Run in the Supabase SQL Editor.

create or replace function public.get_recall_global_stats()
returns json
language sql
security definer
set statement_timeout = '30s'
as $$
  with base as materialized (
    select puzzle, score, grade from recall_events where mode = 'recall_unlimited'
  ),
  agg as (
    select count(*) as n, round(avg(score)) as avg_score,
      round(avg(case grade
        when 'A+' then 4.0 when 'A' then 4.0 when 'A-' then 3.66
        when 'B+' then 3.33 when 'B' then 3.0 when 'B-' then 2.66
        when 'C+' then 2.33 when 'C' then 2.0 when 'C-' then 1.66
        when 'D+' then 1.33 when 'D' then 1.0 when 'D-' then 0.66
        when 'F' then 0.0 else null end)::numeric, 2) as avg_gpa,
      count(*) filter (where grade in ('A+','A','A-')) as a,
      count(*) filter (where grade in ('B+','B','B-')) as b,
      count(*) filter (where grade in ('C+','C','C-')) as c,
      count(*) filter (where grade in ('D+','D','D-')) as d,
      count(*) filter (where grade = 'F') as f
    from base
  ),
  per_puzzle as (
    select puzzle, round(avg(score)) as avg_score
    from base where puzzle is not null
    group by puzzle having count(*) >= 10
  )
  select json_build_object(
    'total_plays', n, 'unlimited_plays', n, 'avg_score', avg_score, 'avg_gpa', avg_gpa,
    'grade_dist', json_build_object('A', a, 'B', b, 'C', c, 'D', d, 'F', f),
    'easiest', (select json_agg(r) from (select puzzle, avg_score from per_puzzle order by avg_score desc, puzzle limit 5) r),
    'hardest', (select json_agg(r) from (select puzzle, avg_score from per_puzzle order by avg_score asc, puzzle limit 5) r)
  )
  from agg;
$$;

create or replace function public.get_bb_recall_global_stats()
returns json
language sql
security definer
set statement_timeout = '30s'
as $$
  with base as materialized (
    select puzzle, score, grade from bb_recall_events where mode = 'bb_recall_unlimited'
  ),
  agg as (
    select count(*) as n, round(avg(score)) as avg_score,
      round(avg(case grade
        when 'A+' then 4.0 when 'A' then 4.0 when 'A-' then 3.66
        when 'B+' then 3.33 when 'B' then 3.0 when 'B-' then 2.66
        when 'C+' then 2.33 when 'C' then 2.0 when 'C-' then 1.66
        when 'D+' then 1.33 when 'D' then 1.0 when 'D-' then 0.66
        when 'F' then 0.0 else null end)::numeric, 2) as avg_gpa,
      count(*) filter (where grade in ('A+','A','A-')) as a,
      count(*) filter (where grade in ('B+','B','B-')) as b,
      count(*) filter (where grade in ('C+','C','C-')) as c,
      count(*) filter (where grade in ('D+','D','D-')) as d,
      count(*) filter (where grade = 'F') as f
    from base
  ),
  per_puzzle as (
    select puzzle, round(avg(score)) as avg_score
    from base where puzzle is not null
    group by puzzle having count(*) >= 10
  )
  select json_build_object(
    'total_plays', n, 'unlimited_plays', n, 'avg_score', avg_score, 'avg_gpa', avg_gpa,
    'grade_dist', json_build_object('A', a, 'B', b, 'C', c, 'D', d, 'F', f),
    'easiest', (select json_agg(r) from (select puzzle, avg_score from per_puzzle order by avg_score desc, puzzle limit 5) r),
    'hardest', (select json_agg(r) from (select puzzle, avg_score from per_puzzle order by avg_score asc, puzzle limit 5) r)
  )
  from agg;
$$;

grant execute on function public.get_recall_global_stats(), public.get_bb_recall_global_stats() to anon;

-- Indexes last.
create index if not exists recall_events_mode_idx on recall_events (mode);
create index if not exists bb_recall_events_mode_idx on bb_recall_events (mode);
