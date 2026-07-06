-- Practice vs Simulation exam modes, plus pause support for practice.
--
-- mode         'simulation' — fixed duration, no pause (the real-exam feel)
--              'practice'   — student-chosen duration (20–90 min), pausable
--              Existing rows predate modes, so they default to 'simulation'.
-- duration_sec the session's length in seconds (simulation = the test's own
--              duration; practice = the chosen 20–90 minutes). Nullable so old
--              rows stay valid.
-- paused_at    set while a practice timer is FROZEN (null = running). Resuming
--              shifts expires_at forward by the paused span, so the remaining
--              time is preserved exactly. Simulation sessions never set this.
alter table public.test_sessions
  add column mode text not null default 'simulation'
    check (mode in ('simulation', 'practice')),
  add column duration_sec integer,
  add column paused_at timestamptz;
