-- Average guesses per win for one mode ('daily' = Survivordle daily, 'bb' = Big Brotherdle daily).
-- Run in the Supabase SQL Editor.
create or replace function public.get_daily_avg_guesses(p_mode text)
returns json
language sql
security definer
set statement_timeout = '30s'
as $$
  select json_build_object('avg_guesses', round(avg(guesses)::numeric, 2), 'wins', count(*))
  from (
    select guesses from solve_events where p_mode = 'daily' and mode = 'daily' and won
    union all
    select guesses from bb_solve_events where p_mode = 'bb' and mode = 'bb' and won
  ) t;
$$;
grant execute on function public.get_daily_avg_guesses(text) to anon;
