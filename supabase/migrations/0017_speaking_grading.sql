-- Speaking: graded attempts + the short-lived audio the grader reads.
--
-- WE DO NOT KEEP RECORDINGS. A student's clips are uploaded to a private
-- bucket, read once by the grade-speaking edge function, and deleted the moment
-- grading finishes. The bucket exists only so a failed grade is recoverable
-- (network drop, Gemini 503) instead of losing a ten-minute attempt; anything
-- older than an hour is swept away. What we keep is the TRANSCRIPT and the
-- feedback — text, not voice.
--
-- Speaking papers are NOT rows in `tests` (they are derived from the samples
-- library), so this table carries the paper's identity as plain columns rather
-- than a foreign key.

create table if not exists public.speaking_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Paper identity, denormalised: `speaking-mock-11`, `speaking-sp-t11-12`, or
  -- a custom prompt id. Title is stored so history survives a paper's removal.
  test_id text not null,
  test_title text not null,
  scope text not null default 'full' check (scope in ('full', 'part')),
  part_type text check (
    part_type in ('part_1_1', 'part_1_2', 'part_2', 'part_3')
  ),

  status text not null default 'grading' check (status in ('grading', 'done', 'failed')),
  error_message text,

  -- Rubric: four blocks (Q1-3, Q4-6, Q7, Q8) worth 5/5/5/6 = 21 raw, mapped
  -- through the official rating table to 0-75, then to a CEFR band.
  raw_score numeric(4, 1),
  rating integer,
  -- NULL for single-part drills: one block cannot produce a real /75 band, so
  -- drills show an ESTIMATE on screen that never enters the student's history.
  band text check (band in ('below_B1', 'B1', 'B2', 'C1')),

  -- Everything the analyze page renders: per-block scores, per-answer
  -- transcripts, errors, strengths, improved versions, fluency stats.
  result jsonb,

  created_at timestamptz not null default now(),
  graded_at timestamptz
);

create index if not exists speaking_attempts_user_created_idx
  on public.speaking_attempts (user_id, created_at desc);

-- Monthly plan-limit counting reads status + created_at for one user.
create index if not exists speaking_attempts_user_status_idx
  on public.speaking_attempts (user_id, status, created_at desc);

alter table public.speaking_attempts enable row level security;

-- Students may READ their own attempts and nothing else. There is deliberately
-- no insert/update/delete policy: only the grade-speaking edge function writes
-- here, with the service_role key, exactly like `attempts` and `plan_changes`.
drop policy if exists "own speaking attempts are readable" on public.speaking_attempts;
create policy "own speaking attempts are readable"
  on public.speaking_attempts for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- The transient audio bucket.
-- Private (no public URL), 8 MB per clip — a 2-minute Opus answer is ~350 KB,
-- so this is a generous ceiling that still stops an upload flood.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'speaking-temp',
  'speaking-temp',
  false,
  8388608,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A student may only write inside a folder named after their own user id, and
-- may never read anything back — the clips exist for the grader, not for replay.
drop policy if exists "students upload their own speaking clips" on storage.objects;
create policy "students upload their own speaking clips"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'speaking-temp'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
