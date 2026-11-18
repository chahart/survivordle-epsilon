-- Rank mode: tier lists, logged for later (no public consensus board yet).
-- One row per person per tier list (a board like 'winners' / 's50', or a
-- template like 't-returning-winners'); a new save replaces the old one.
-- Same pattern as rank_submissions.sql: RLS on, no anon policies, writes only
-- through the function below. Read it from the SQL editor when you want it.

create table if not exists rank_tier_lists (
  anon_id text not null,
  kind text not null,
  tiers jsonb not null, -- [{ "name": "S", "items": ["US0016_1", "S12", ...] }, ...] best first
  placed integer not null,
  updated_at timestamptz not null default now(),
  primary key (anon_id, kind)
);
alter table rank_tier_lists enable row level security;

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
  if p_kind is null or p_kind !~ '^(winners|seasons|s[0-9]{1,3}|t-[a-z0-9-]{1,40})$' then
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

grant execute on function submit_rank_tiers(text, text, jsonb, integer) to anon;

-- Verify:
-- select submit_rank_tiers('test-anon-id-1', 'winners', '[{"name":"S","items":["US0016_1","US0032_2","US0048_3","US0096_6","US0112_7"]}]', 5);
-- select * from rank_tier_lists;
-- delete from rank_tier_lists where anon_id = 'test-anon-id-1';
--
-- Example: average tier per item (0 = top tier) for one board, once you want it:
-- select item, round(avg(t.ord - 1), 2) as avg_tier, count(*) as lists
-- from rank_tier_lists, jsonb_array_elements(tiers) with ordinality t(tier, ord),
--      jsonb_array_elements_text(t.tier->'items') item
-- where kind = 'winners' group by item having count(*) >= 5 order by avg_tier;
