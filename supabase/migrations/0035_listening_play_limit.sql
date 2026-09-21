-- Enforce the listening play limit on the server.
--
-- Until now the play limit lived only in the browser: the `audio` bucket was
-- public, so any student could replay a simulation recording by refreshing,
-- exiting and resuming, or opening the public URL in another tab.
--
-- From here on:
--   1) The `audio` bucket is PRIVATE. Students never get a permanent URL; the
--      `listening-audio` edge function hands out short-lived signed URLs.
--   2) Every simulation play is a row in `listening_plays`. The function refuses
--      to start play N+1 once N = the recording's playLimit, and a refresh
--      RESUMES the running play at the elapsed offset instead of restarting it.
--   3) Admins can still read the bucket directly (upsert uploads and the
--      console's audio previews need a select policy once it is private).
-- The `images` bucket stays public — map images and sample photos carry no
-- exam secret.

-- 1) plays --------------------------------------------------------------------
create table if not exists public.listening_plays (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.test_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_path text not null,
  -- 1-based. The unique index makes two tabs racing for the last play fail
  -- instead of both succeeding.
  play_no int not null check (play_no >= 1),
  started_at timestamptz not null default now(),
  unique (session_id, asset_path, play_no)
);

alter table public.listening_plays enable row level security;
-- No policies: service_role only, like test_content.
revoke all on public.listening_plays from anon, authenticated;

-- 2) bucket -------------------------------------------------------------------
update storage.buckets set public = false where id = 'audio';

drop policy if exists "listening media public read" on storage.objects;
create policy "listening images public read"
  on storage.objects for select
  using (bucket_id = 'images');

drop policy if exists "listening audio admin read" on storage.objects;
create policy "listening audio admin read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'audio' and public.is_admin(auth.uid()));
