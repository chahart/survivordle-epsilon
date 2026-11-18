-- Rank mode v2: head-to-head consensus + Today's Matchup.
-- Run after rank_submissions.sql and rank_players.sql, in the Supabase SQL Editor.
-- Same pattern as before: RLS on, no anon policies, access only through
-- security-definer functions.

-- 1. Player boards now store each player's castaway number (US0009 -> 9) instead
--    of their position in the placement order. Old player rows used the old key,
--    so drop them (Rank was still hidden; nobody public has voted).
delete from rank_boards where kind ~ '^s[0-9]{1,3}$';

-- 2. Today's Matchup: one vote per person per day.
create table if not exists rank_daily_votes (
  day date not null,
  anon_id text not null,
  kind text not null check (kind in ('winners', 'seasons')),
  pick integer not null,  -- season number of the chosen item
  other integer not null, -- season number of the one not chosen
  created_at timestamptz not null default now(),
  primary key (day, anon_id)
);
alter table rank_daily_votes enable row level security;

create or replace function vote_rank_daily(p_anon_id text, p_day date, p_kind text, p_pick integer, p_other integer)
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
  -- Only today's matchup (one day of slack either way for time zones).
  if p_day is null or p_day < current_date - 1 or p_day > current_date + 1 then
    raise exception 'bad day';
  end if;
  if p_pick is null or p_other is null or p_pick < 1 or p_other < 1 or p_pick = p_other then
    raise exception 'bad pick';
  end if;
  insert into rank_daily_votes (day, anon_id, kind, pick, other)
  values (p_day, p_anon_id, p_kind, p_pick, p_other)
  on conflict (day, anon_id) do nothing; -- first vote counts
end;
$$;

-- Votes per side for one day's matchup.
create or replace function get_rank_daily(p_day date)
returns table (pick integer, votes bigint)
language sql
security definer
set search_path = public
as $$
  select pick, count(*) from rank_daily_votes where day = p_day group by pick;
$$;

-- 3. Head-to-head counts for the consensus: how many times `hi` was put above
--    `lo`. Each full ranking counts every pair it orders; each Today's Matchup
--    vote counts once. The client turns these into scores (Bradley-Terry), which
--    corrects for who each item was compared against, so people who only ranked
--    a few seasons don't drag those seasons down.
-- shortcut: computed live per request (~1.2k pairs per 50-item board); move to a
-- materialized view refreshed by pg_cron once there are ~5k boards.
create or replace function get_rank_pairs(p_kind text)
returns table (hi integer, lo integer, n bigint)
language sql
security definer
set search_path = public
as $$
  with s as (
    select ranking from rank_boards where kind = p_kind and cardinality(ranking) >= 10
  ),
  p as (
    select a.sn as hi, b.sn as lo
    from s,
         unnest(s.ranking) with ordinality a(sn, pos),
         unnest(s.ranking) with ordinality b(sn, pos)
    where a.pos < b.pos
    union all
    select pick, other from rank_daily_votes where kind = p_kind
  )
  select hi, lo, count(*) from p group by hi, lo;
$$;

grant execute on function vote_rank_daily(text, date, text, integer, integer) to anon;
grant execute on function get_rank_daily(date) to anon;
grant execute on function get_rank_pairs(text) to anon;

-- Verify:
-- select submit_rank_board('test-anon-id-1', 'seasons', (select array_agg(g) from generate_series(1,12) g));
-- select vote_rank_daily('test-anon-id-1', current_date, 'seasons', 3, 7);
-- select * from get_rank_pairs('seasons') order by n desc limit 5;
-- select * from get_rank_daily(current_date);
-- Then clean up:
-- delete from rank_boards where anon_id = 'test-anon-id-1';
-- delete from rank_daily_votes where anon_id = 'test-anon-id-1';
