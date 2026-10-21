-- Rank mode: one row per person's (finished or stopped-early) winner ranking.
-- NOT one row per vote — a ranking is a single ordered array of winner season
-- numbers, best first. A person's repeat submissions replace their old row
-- (keyed by a random id kept in their browser), so nobody can stack votes.
--
-- The table has RLS on and NO direct anon policies: all access goes through the
-- two security-definer functions below, so anon can't read, update or delete rows.
--
-- Run this in the Supabase SQL Editor. It does not touch any existing table.

create table if not exists rank_submissions (
  anon_id text primary key,
  ranking integer[] not null, -- winner season numbers, best first
  updated_at timestamptz not null default now()
);

alter table rank_submissions enable row level security;

create or replace function submit_rank(p_anon_id text, p_ranking integer[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_anon_id is null or length(p_anon_id) < 8 or length(p_anon_id) > 64 then
    raise exception 'bad id';
  end if;
  if p_ranking is null
     or cardinality(p_ranking) < 20
     or cardinality(p_ranking) > 200
     or (select count(distinct x) from unnest(p_ranking) x) <> cardinality(p_ranking)
     or (select min(x) from unnest(p_ranking) x) < 1 then
    raise exception 'bad ranking';
  end if;

  insert into rank_submissions (anon_id, ranking, updated_at)
  values (p_anon_id, p_ranking, now())
  on conflict (anon_id) do update
    set ranking = excluded.ranking, updated_at = now();
end;
$$;

-- Consensus leaderboard. Each ranking turns a winner's position into 0 (best)
-- to 1 (worst) among the winners that person ranked, then we average per winner.
-- Rankings under 20 winners are ignored (also enforced on submit).
create or replace function get_rank_leaderboard()
returns table (win_season integer, avg_pct numeric, votes bigint, total_subs bigint)
language sql
security definer
set search_path = public
as $$
  with s as (
    select ranking, cardinality(ranking) as n
    from rank_submissions
    where cardinality(ranking) >= 20
  ),
  e as (
    select u.sn, (u.pos - 1)::numeric / (s.n - 1) as pct
    from s, unnest(s.ranking) with ordinality as u(sn, pos)
  )
  select e.sn as win_season,
         round(avg(e.pct), 4) as avg_pct,
         count(*) as votes,
         (select count(*) from s) as total_subs
  from e
  group by e.sn
  order by avg(e.pct) asc, count(*) desc;
$$;

grant execute on function submit_rank(text, integer[]) to anon;
grant execute on function get_rank_leaderboard() to anon;

-- Verify:
-- select submit_rank('test-anon-id-1', (select array_agg(g) from generate_series(1,25) g));
-- select * from get_rank_leaderboard() limit 5;
-- Then clean up: delete from rank_submissions where anon_id = 'test-anon-id-1';
