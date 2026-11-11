-- Rank mode, player boards: allow kinds like 's50' (season 50's cast). The ranking
-- array holds each player's position in the placement-sorted cast (1..n), best
-- ranked first. Run after rank_submissions.sql. Only the kind checks change.

alter table rank_boards drop constraint if exists rank_boards_kind_check;
alter table rank_boards add constraint rank_boards_kind_check
  check (kind in ('winners', 'seasons') or kind ~ '^s[0-9]{1,3}$');

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
  if p_kind not in ('winners', 'seasons') and p_kind !~ '^s[0-9]{1,3}$' then
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
-- get_rank_board(p_kind) already works for any kind.
