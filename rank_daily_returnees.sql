-- Today's Matchup can now be a returnees day ("Who's the better all-time player?").
-- Run once in the Supabase SQL editor. Widens the kind check on both shows' daily
-- vote tables and vote functions; picks are castaway / houseguest numbers, the same
-- keys the returnees board uses, so these votes also feed the returnees consensus.

alter table rank_daily_votes drop constraint if exists rank_daily_votes_kind_check;
alter table rank_daily_votes add constraint rank_daily_votes_kind_check check (kind in ('winners', 'seasons', 'returnees'));
alter table bb_rank_daily_votes drop constraint if exists bb_rank_daily_votes_kind_check;
alter table bb_rank_daily_votes add constraint bb_rank_daily_votes_kind_check check (kind in ('winners', 'seasons', 'returnees'));

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
  if p_kind not in ('winners', 'seasons', 'returnees') then
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
  if p_kind not in ('winners', 'seasons', 'returnees') then
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
