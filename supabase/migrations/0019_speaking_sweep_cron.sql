-- Run the speaking-audio sweep every hour, whether or not anyone is grading.
--
-- Until now the cleanup only ran at the end of a successful grade, so a quiet
-- week left abandoned recordings sitting in the bucket for a week. Students are
-- told their voice is not kept; that has to be true even with no traffic.
--
-- THE SECRET IS NOT IN THIS FILE. The sweep function has no user behind it, so
-- it authorises on a shared secret, which lives in Supabase Vault and is read
-- back at call time. Create it once per environment (value comes from the
-- function's SWEEP_SECRET env var), then this migration is safe to commit:
--
--   select vault.create_secret('<the value>', 'speaking_sweep_secret');

create extension if not exists pg_cron with schema pg_catalog;
-- pg_net always exposes itself as net.http_post, whatever schema it is
-- installed into — do NOT write extensions.http_post here, it does not exist.
create extension if not exists pg_net with schema extensions;

-- Idempotent: unschedule first so re-running does not stack duplicate jobs.
select cron.unschedule('speaking-audio-sweep')
where exists (select 1 from cron.job where jobname = 'speaking-audio-sweep');

select cron.schedule(
  'speaking-audio-sweep',
  '7 * * * *',  -- once an hour, off the hour so it misses the cron rush
  $job$
  select net.http_post(
    url := 'https://ktxharmjdgkfxkoiymhd.supabase.co/functions/v1/sweep-speaking-audio',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sweep-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'speaking_sweep_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
