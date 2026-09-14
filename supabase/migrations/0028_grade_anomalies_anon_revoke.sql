-- Close the speaking anomaly view to students and to signed-out visitors.
--
-- 0025 created `speaking_grade_anomalies` with the comment "Service-role only"
-- and put RLS on the alerts TABLE beside it. The table was fine. The VIEW was
-- not: a view has no row level security of its own, it runs with its owner's
-- rights unless told otherwise, and Supabase's public-schema defaults hand
-- SELECT to `anon` and `authenticated`. So the one object built to hold the
-- worst grades in the system was readable by anybody with the publishable key.
--
-- Verified against production before this migration: as `anon`,
-- `select count(*) from public.speaking_attempts` returned 0 (RLS working) but
-- `select count(*) from public.speaking_grade_anomalies` returned 5 — the view
-- laundered the same rows past the policy that was meant to protect them. It
-- exposes user_id, rating, band, the failing block's score and the model name,
-- which is every student in the queue, named by id, with their worst mark.
--
-- 0023 already wrote the rule this broke: "RULE FOR ANY FUTURE VIEW IN `public`:
-- it bypasses RLS and is exposed to anon unless you revoke it." 0025 was the
-- next view added and it did not follow it. Hence the second lock below —
-- a rule in a comment stopped nothing.

-- Lock 1: take the grants away. service_role keeps its own, which is what the
-- nightly sweep and the admin console read through.
revoke all on public.speaking_grade_anomalies from anon;
revoke all on public.speaking_grade_anomalies from authenticated;

-- Lock 2: make the view run as whoever queries it, so the RLS on
-- speaking_attempts applies to the caller instead of being bypassed by the
-- owner. If a future default grant hands SELECT back to `authenticated`, a
-- student still sees only their own rows rather than everyone's.
--
-- The sweep is unaffected: sweep_speaking_grade_anomalies() is SECURITY DEFINER
-- owned by postgres, so inside it the view is queried as postgres and still
-- sees every row. service_role has BYPASSRLS, so the admin reads are unaffected
-- too. Both were checked in a rolled-back transaction against production:
--   anon_can_select false · auth_can_select false · service_can_select true
--   service_bypasses_rls true · rows_still_visible 5 · sweep_still_works ok
alter view public.speaking_grade_anomalies set (security_invoker = on);
