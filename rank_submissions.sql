-- Rank mode: one row per person per board ("winners" or "seasons") holding their
-- (finished or stopped-early) ranking.
-- NOT one row per vote — a ranking is a single ordered array of season numbers,
-- best first (for "winners" the number is the season that winner won). A
-- person's repeat submissions replace their old row (keyed by a random id kept in
-- their browser), so nobody can stack votes.
--
-- The table has RLS on and NO direct anon policies: all access goes through the
-- two security-definer functions below, so anon can't read, update or delete rows.
--
-- Run this in the Supabase SQL Editor. It does not touch any existing table.
-- (If you ran the earlier version of this file, rank_submissions and its two
-- functions are now unused and can be dropped.)

create table if not exists rank_boards (
  anon_id text not null,
  kind text not null check (kind in ('winners', 'seasons')),
  ranking integer[] not null, -- season numbers, best first
  updated_at timestamptz not null default now(),
  primary key (anon_id, kind)
);

alter table rank_boards enable row level security;

create or replace function submit_rank_board(p_anon_id text, p_kind text, p_ranking integer[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_anon_id is null or length(p_anon_id) < 8 or length(p_anon_id) > 64 then
    raise exception 'bad id';
  end if;
  if p_kind not in ('winners', 'seasons') then
    raise exception 'bad kind';
  end if;
  if p_ranking is null
     or cardinality(p_ranking) < 10
     or cardinality(p_ranking) > 200
     or (select count(distinct x) from unnest(p_ranking) x) <> cardinality(p_ranking)
     or (select min(x) from unnest(p_ranking) x) < 1 then
    raise exception 'bad ranking';
  end if;

  insert into rank_boards (anon_id, kind, ranking, updated_at)
  values (p_anon_id, p_kind, p_ranking, now())
  on conflict (anon_id, kind) do update
    set ranking = excluded.ranking, updated_at = now();
end;
$$;

-- Consensus leaderboard. Each ranking turns an item's position into 0 (best)
-- to 1 (worst) among the items that person ranked, then we average per item.
-- Rankings under 10 items are ignored (also enforced on submit).
create or replace function get_rank_board(p_kind text)
returns table (win_season integer, avg_pct numeric, votes bigint, total_subs bigint)
language sql
security definer
set search_path = public
as $$
  with s as (
    select ranking, cardinality(ranking) as n
    from rank_boards
    where kind = p_kind and cardinality(ranking) >= 10
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

grant execute on function submit_rank_board(text, text, integer[]) to anon;
grant execute on function get_rank_board(text) to anon;

-- Verify:
-- select submit_rank_board('test-anon-id-1', 'seasons', (select array_agg(g) from generate_series(1,25) g));
-- select * from get_rank_board('seasons') limit 5;
-- Then clean up: delete from rank_boards where anon_id = 'test-anon-id-1';
