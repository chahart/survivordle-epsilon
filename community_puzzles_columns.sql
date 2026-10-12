-- Community puzzles, step 1 of 2: new columns + timestamp trigger.
-- Purely additive — safe to run at any time, existing links keep working.
-- Run this in the Supabase SQL Editor BEFORE deploying the new app code.

alter table custom_connections_puzzles
  add column if not exists description text,
  add column if not exists status text not null default 'private',
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists featured_at timestamptz;

-- status lifecycle: private (default, link-only) -> submitted (author opted in
-- for review) -> approved (listed on Community) -> featured (top of Community)
-- or rejected. You only ever need to change `status` by hand; the trigger
-- below stamps the dates.
alter table custom_connections_puzzles
  drop constraint if exists custom_connections_status_check,
  add constraint custom_connections_status_check
    check (status in ('private', 'submitted', 'approved', 'featured', 'rejected'));

alter table custom_connections_puzzles
  drop constraint if exists custom_connections_description_len,
  add constraint custom_connections_description_len
    check (description is null or char_length(description) <= 280);

create or replace function custom_connections_stamp_dates()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'submitted' then
      new.submitted_at := now();
    end if;
    -- Clients can't backdate or pre-stamp review fields.
    new.reviewed_at := null;
    new.featured_at := null;
  elsif new.status is distinct from old.status then
    if new.status in ('approved', 'featured', 'rejected') then
      new.reviewed_at := now();
    end if;
    if new.status = 'featured' then
      new.featured_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists custom_connections_stamp_dates on custom_connections_puzzles;
create trigger custom_connections_stamp_dates
  before insert or update on custom_connections_puzzles
  for each row execute function custom_connections_stamp_dates();

-- Load a single puzzle by its code, regardless of status (rejected too, so
-- already-shared links keep working unless you delete the row). The app reads
-- puzzles through this so the table itself can later be locked down to
-- approved/featured rows only (community_puzzles_rls.sql).
create or replace function get_custom_puzzle(p_code text)
returns table (title text, author text, groups jsonb)
language sql
security definer
set search_path = public
as $$
  select title, author, groups
  from custom_connections_puzzles
  where code = p_code;
$$;

revoke all on function get_custom_puzzle(text) from public;
grant execute on function get_custom_puzzle(text) to anon;

-- Speeds up the Community page queries.
create index if not exists custom_connections_status_idx
  on custom_connections_puzzles (status, reviewed_at desc);

-- ── Your review workflow (save these as SQL Editor snippets) ────────────────
-- Queue:
--   select code, title, author, description, groups, submitted_at
--   from custom_connections_puzzles
--   where status = 'submitted' order by submitted_at;
-- Play one before deciding: survivordle.com/connections/custom/<code>
-- Approve / feature / reject:
--   update custom_connections_puzzles set status = 'approved' where code = '...';
--   update custom_connections_puzzles set status = 'featured' where code = '...';
--   update custom_connections_puzzles set status = 'rejected' where code = '...';
