-- Onboarding answers on profiles (collected ONCE by the /welcome wizard right
-- after registration; onboarded_at is the asked-once flag — null = show the
-- wizard, set = never ask again). The answers personalize the dashboard now
-- (goal marker, exam countdown, focus badges) and feed the future study-
-- roadmap feature; heard_from is marketing attribution.
--
-- SECURITY: same column-grant model as 0005_roles — the "own profile update"
-- RLS policy stays, and users can update ONLY name + these onboarding columns.
-- role remains changeable exclusively via the admin-users edge function.

alter table public.profiles
  add column onboarded_at    timestamptz,
  add column first_exam      text check (first_exam in ('first_time', 'took_mock', 'took_real')),
  add column self_level      text check (self_level in ('unknown', 'below_B1', 'B1', 'B2', 'C1')),
  add column target_band     text check (target_band in ('B1', 'B2', 'C1')),
  add column exam_month      date,
  add column weak_areas      text[] not null default '{}'
    check (weak_areas <@ array['reading', 'listening', 'writing', 'speaking', 'vocabulary', 'timing']::text[]),
  add column daily_minutes   smallint check (daily_minutes in (15, 30, 60, 120)),
  add column heard_from      text check (heard_from in
    ('telegram', 'instagram', 'youtube', 'friend_teacher', 'learning_centre', 'milliymock', 'google', 'other')),
  add column heard_from_note text check (char_length(heard_from_note) <= 200);

grant update (onboarded_at, first_exam, self_level, target_band, exam_month,
              weak_areas, daily_minutes, heard_from, heard_from_note)
  on table public.profiles to authenticated;
