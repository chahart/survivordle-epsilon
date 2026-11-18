-- Rank mode: "Best returnees to never win" board (kind 'returnees').
-- Rankings hold each player's castaway number (US0009 -> 9), best first, like the
-- season-cast boards. Run after rank_players.sql and rank_tier_lists.sql.
-- Only the kind checks change; get_rank_board / get_rank_pairs already work for any kind.

alter table rank_boards drop constraint if exists rank_boards_kind_check;
alter table rank_boards add constraint rank_boards_kind_check
  check (kind in ('winners', 'seasons', 'returnees') or kind ~ '^s[0-9]{1,3}$');

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

  insert into rank_boards (anon_id, kind, ranking, updated_at)
  values (p_anon_id, p_kind, p_ranking, now())
  on conflict (anon_id, kind) do update
    set ranking = excluded.ranking, updated_at = now();
end;
$$;

create or replace function submit_rank_tiers(p_anon_id text, p_kind text, p_tiers jsonb, p_placed integer)
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

  insert into rank_tier_lists (anon_id, kind, tiers, placed, updated_at)
  values (p_anon_id, p_kind, p_tiers, p_placed, now())
  on conflict (anon_id, kind) do update
    set tiers = excluded.tiers, placed = excluded.placed, updated_at = now();
end;
$$;

-- Verify:
-- select submit_rank_board('test-anon-id-1', 'returnees', (select array_agg(g) from generate_series(1,12) g));
-- select * from get_rank_board('returnees') limit 3;
-- delete from rank_boards where anon_id = 'test-anon-id-1';
