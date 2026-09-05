-- Speaking: find impossible grades before a student does.
--
-- Every wrong-mark defect in docs/SPEAKING-DEFECTS.md was found because someone
-- wrote in to say their mark was unfair. The database could have seen all of
-- them: a block scoring zero on two hundred words of speech is not a judgement
-- call, it is arithmetic that cannot be right.
--
-- This is a detector, not a gate. It never changes a mark. It writes a row a
-- human reads.

create table if not exists public.speaking_grade_alerts (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.speaking_attempts(id) on delete cascade,
  kind        text not null,
  detail      jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  note        text,
  unique (attempt_id, kind)
);

comment on table public.speaking_grade_alerts is
  'Impossible-looking speaking grades, found by the nightly sweep. Read by staff; never changes a mark.';

alter table public.speaking_grade_alerts enable row level security;
-- No policies: service_role only, like plan_changes. Students must never see these.

create index if not exists speaking_grade_alerts_open_idx
  on public.speaking_grade_alerts (detected_at desc) where resolved_at is null;

-- ---------------------------------------------------------------------------
-- The view. Each block is matched to its own answers by position: the blocks
-- array is in paper order and its questionCount values sum to the answer count,
-- so a running total gives every block its slice exactly.
-- ---------------------------------------------------------------------------
create or replace view public.speaking_grade_anomalies as
with blocks as (
  select
    s.id            as attempt_id,
    s.user_id,
    s.created_at,
    s.rating,
    s.band,
    s.result->>'model'                    as model,
    b.value->>'key'                       as block_key,
    (b.value->>'score')::numeric          as score,
    coalesce((b.value->>'questionCount')::int, 0) as question_count,
    sum(coalesce((b.value->>'questionCount')::int, 0))
      over (partition by s.id order by b.ordinality
            rows between unbounded preceding and 1 preceding) as offset_before,
    s.result->'answers'                   as answers
  from public.speaking_attempts s
  cross join lateral jsonb_array_elements(s.result->'blocks') with ordinality b(value, ordinality)
  where s.status = 'done' and jsonb_typeof(s.result->'blocks') = 'array'
),
scored as (
  select
    blocks.*,
    (
      select count(*)
      from jsonb_array_elements(blocks.answers) with ordinality a(value, ordinality)
      where a.ordinality > coalesce(blocks.offset_before, 0)
        and a.ordinality <= coalesce(blocks.offset_before, 0) + blocks.question_count
        and array_length(
              regexp_split_to_array(trim(coalesce(a.value->>'transcript', '')), '\s+'), 1
            ) >= 10
    ) as spoken
  from blocks
)
select
  attempt_id,
  user_id,
  created_at,
  'zero_with_speech'::text as kind,
  jsonb_build_object(
    'block', block_key, 'score', score, 'spoken', spoken,
    'questionCount', question_count, 'rating', rating, 'band', band, 'model', model
  ) as detail
from scored
where score = 0 and spoken > 0

union all

-- A student's own two attempts should not land more than one band apart. Before
-- the 2026-09-01 fix they averaged 18 rating points apart, worst case 28.
select
  attempt_id, user_id, created_at, 'band_swing'::text,
  jsonb_build_object('rating', rating, 'previousRating', prev_rating,
                     'band', band, 'previousBand', prev_band, 'gap', abs(rating - prev_rating))
from (
  select s.id as attempt_id, s.user_id, s.created_at, s.rating, s.band,
         lag(s.rating) over w as prev_rating,
         lag(s.band)   over w as prev_band
  from public.speaking_attempts s
  where s.status = 'done' and s.scope = 'full' and s.rating is not null
  window w as (partition by s.user_id order by s.created_at)
) swings
where prev_rating is not null and abs(rating - prev_rating) > 15

union all

-- A grade with no language profile scores every block 0 by design (#13's
-- safeguard). It should never actually happen.
select s.id, s.user_id, s.created_at, 'no_profile'::text,
       jsonb_build_object('rating', s.rating, 'band', s.band, 'model', s.result->>'model')
from public.speaking_attempts s
where s.status = 'done' and s.result->'profile'->'criteria' is null
  -- One language profile per attempt shipped 2026-09-01 (defect #14). Rows
  -- older than that legitimately have none and can never be fixed; flagging
  -- them forever would train everyone to ignore this queue.
  and s.created_at >= timestamptz '2026-09-01'

union all

-- A check that never finished and never failed (#19). Anything older than
-- 15 minutes is dead, not working.
select s.id, s.user_id, s.created_at, 'stuck_grading'::text,
       jsonb_build_object('startedAt', s.grading_started_at, 'runs', s.grading_runs)
from public.speaking_attempts s
where s.status = 'grading' and s.created_at < now() - interval '15 minutes';

comment on view public.speaking_grade_anomalies is
  'Speaking grades that cannot be right. See docs/SPEAKING-DEFECTS.md.';

-- ---------------------------------------------------------------------------
-- Nightly sweep, 02:15 UTC. Alerts are deduped per (attempt, kind), so a row
-- appears once and stays until somebody sets resolved_at.
-- ---------------------------------------------------------------------------
create or replace function public.sweep_speaking_grade_anomalies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  insert into public.speaking_grade_alerts (attempt_id, kind, detail)
  select attempt_id, kind, detail
  from public.speaking_grade_anomalies
  where created_at > now() - interval '30 days'
  on conflict (attempt_id, kind) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function public.sweep_speaking_grade_anomalies() from public, anon, authenticated;

select cron.unschedule('speaking-anomaly-sweep')
where exists (select 1 from cron.job where jobname = 'speaking-anomaly-sweep');

select cron.schedule(
  'speaking-anomaly-sweep',
  '15 2 * * *',
  $$select public.sweep_speaking_grade_anomalies();$$
);
