-- Make a failed speaking check retryable after the page is gone.
--
-- The clips survive a failure (they are only swept after an hour), but the
-- mapping from clip -> question lived in the browser tab, so closing it made a
-- retry impossible even though the audio was still there. Storing that manifest
-- on the attempt lets My Results offer "try again" with nothing but the id.
--
-- The manifest holds paths and question text only. No audio, and it is cleared
-- as soon as grading succeeds and the clips are deleted.

alter table public.speaking_attempts
  add column if not exists audio_manifest jsonb;

comment on column public.speaking_attempts.audio_manifest is
  'Clip paths + question text for an ungraded attempt, so a failed check can be retried within the hour the clips survive. Cleared on success.';
