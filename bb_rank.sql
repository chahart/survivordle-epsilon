-- Big Brother Rank: its own tables and functions (bb_*), fully separate from
-- Survivor Rank. Mirrors the latest Survivor versions in rank_submissions.sql,
-- rank_players.sql, rank_consensus_v2.sql, rank_tier_lists.sql and
-- rank_returnees.sql. Run once in the Supabase SQL Editor; touches no existing table.
--
-- Same rules: RLS on, no anon policies, all access through security-definer
-- functions. Keys are BB season numbers (winners / seasons) or houseguest numbers
-- (BB12 -> 12) for cast boards ('s5') and returnees.

-- Rankings: one row per person per board.
create table if not exists bb_rank_boards (
  anon_id text not null,
  kind text not null check (kind in ('winners', 'seasons', 'returnees') or kind ~ '^s[0-9]{1,3}$'),
  ranking integer[] not null,
  updated_at timestamptz not null default now(),
  primary key (anon_id, kind)
);
alter table bb_rank_boards enable row level security;

-- Today's Matchup: one vote per person per day.
create table if not exists bb_rank_daily_votes (
  day date not null,
  anon_id text not null,
  kind text not null check (kind in ('winners', 'seasons')),
  pick integer not null,
  other integer not null,
  created_at timestamptz not null default now(),
  primary key (day, anon_id)
);
alter table bb_rank_daily_votes enable row level security;

-- Tier lists: logged only, no public board yet.
create table if not exists bb_rank_tier_lists (
  anon_id text not null,
  kind text not null,
  tiers jsonb not null,
  placed integer not null,
  updated_at timestamptz not null default now(),
  primary key (anon_id, kind)
);
alter table bb_rank_tier_lists enable row level security;

create or replace function bb_submit_rank_board(p_anon_id text, p_kind text, p_ranking integer[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_anon_id is null or length(p_anon_id) < 8 or length(p_anon_id) > 64 then
    raise exception 'bad id';
  end if;
  if p_kind not in ('winners', 'seasons', 'returnees') and p_kind !~ '^s[0-9]{1,3}$' then
    raise exception 'bad kind';
  end if;
  if p_ranking is null
     or cardinality(p_ranking) < 10
     or cardinality(p_ranking) > 200
     or (select count(distinct x) from unnest(p_ranking) x) <> cardinality(p_ranking)
     or (select min(x) from unnest(p_ranking) x) < 1 then
    raise exception 'bad ranking';
  end if;
  insert into bb_rank_boards (anon_id, kind, ranking, updated_at)
  values (p_anon_id, p_kind, p_ranking, now())
  on conflict (anon_id, kind) do update
    set ranking = excluded.ranking, updated_at = now();
end;
$$;

-- Per item: how many rankings include it (the client needs votes and total_subs).
create or replace function bb_get_rank_board(p_kind text)
returns table (win_season integer, avg_pct numeric, votes bigint, total_subs bigint)
language sql
security definer
set search_path = public
as $$
  with s as (
    select ranking, cardinality(ranking) as n
    from bb_rank_boards
    where kind = p_kind and cardinality(ranking) >= 10
  ),
  e as (
    select u.sn, (u.pos - 1)::numeric / (s.n - 1) as pct
    from s, unnest(s.ranking) with ordinality as u(sn, pos)
  )
  select e.sn, round(avg(e.pct), 4), count(*), (select count(*) from s)
  from e
  group by e.sn
  order by avg(e.pct) asc, count(*) desc;
$$;

-- Head-to-head counts for the consensus (scored client-side with Bradley-Terry).
-- shortcut: computed live per request; move to a materialized view at ~5k boards.
create or replace function bb_get_rank_pairs(p_kind text)
returns table (hi integer, lo integer, n bigint)
language sql
security definer
set search_path = public
as $$
  with s as (
    select ranking from bb_rank_boards where kind = p_kind and cardinality(ranking) >= 10
  ),
  p as (
    select a.sn as hi, b.sn as lo
    from s,
         unnest(s.ranking) with ordinality a(sn, pos),
         unnest(s.ranking) with ordinality b(sn, pos)
    where a.pos < b.pos
    union all
    select pick, other from bb_rank_daily_votes where kind = p_kind
  )
  select hi, lo, count(*) from p group by hi, lo;
$$;

create or replace function bb_vote_rank_daily(p_anon_id text, p_day date, p_kind text, p_pick integer, p_other integer)
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
  if p_day is null or p_day < current_date - 1 or p_day > current_date + 1 then
    raise exception 'bad day';
  end if;
  if p_pick is null or p_other is null or p_pick < 1 or p_other < 1 or p_pick = p_other then
    raise exception 'bad pick';
  end if;
  insert into bb_rank_daily_votes (day, anon_id, kind, pick, other)
  values (p_day, p_anon_id, p_kind, p_pick, p_other)
  on conflict (day, anon_id) do nothing;
end;
$$;

create or replace function bb_get_rank_daily(p_day date)
returns table (pick integer, votes bigint)
language sql
security definer
set search_path = public
as $$
  select pick, count(*) from bb_rank_daily_votes where day = p_day group by pick;
$$;

create or replace function bb_submit_rank_tiers(p_anon_id text, p_kind text, p_tiers jsonb, p_placed integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_anon_id is null or length(p_anon_id) < 8 or length(p_anon_id) > 64 then
    raise exception 'bad id';
  end if;
  if p_kind is null or p_kind !~ '^(winners|seasons|returnees|s[0-9]{1,3}|t-[a-z0-9-]{1,40})$' then
    raise exception 'bad kind';
  end if;
  if p_tiers is null or jsonb_typeof(p_tiers) <> 'array' or jsonb_array_length(p_tiers) > 10
     or length(p_tiers::text) > 20000 or p_placed is null or p_placed < 5 or p_placed > 300 then
    raise exception 'bad tiers';
  end if;
  insert into bb_rank_tier_lists (anon_id, kind, tiers, placed, updated_at)
  values (p_anon_id, p_kind, p_tiers, p_placed, now())
  on conflict (anon_id, kind) do update
    set tiers = excluded.tiers, placed = excluded.placed, updated_at = now();
end;
$$;

grant execute on function bb_submit_rank_board(text, text, integer[]) to anon;
grant execute on function bb_get_rank_board(text) to anon;
grant execute on function bb_get_rank_pairs(text) to anon;
grant execute on function bb_vote_rank_daily(text, date, text, integer, integer) to anon;
grant execute on function bb_get_rank_daily(date) to anon;
grant execute on function bb_submit_rank_tiers(text, text, jsonb, integer) to anon;

-- Verify:
-- select bb_submit_rank_board('test-anon-id-1', 'seasons', (select array_agg(g) from generate_series(1,12) g));
-- select bb_vote_rank_daily('test-anon-id-1', current_date, 'seasons', 3, 7);
-- select * from bb_get_rank_board('seasons') limit 3;
-- select * from bb_get_rank_pairs('seasons') order by n desc limit 3;
-- select * from bb_get_rank_daily(current_date);
-- delete from bb_rank_boards where anon_id = 'test-anon-id-1';
-- delete from bb_rank_daily_votes where anon_id = 'test-anon-id-1';
