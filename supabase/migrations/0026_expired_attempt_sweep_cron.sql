-- Finish the tests whose clock ran out with nobody watching.
--
-- A simulation keeps counting down while the student is away — that is what
-- makes it a mock exam. Until now, hitting zero with the tab closed left the
-- attempt open and ungraded forever; the student had to reopen the paper and
-- hand it in by hand. With the answers mirrored to `session_answers` (0025) the
-- server can do it: this job grades expired attempts, marks them late +
-- auto-submitted, and closes the session. Empty ones are just closed.
--
-- Every 5 minutes, not hourly: "your test finished an hour ago and we only just
-- told you" is not a result a student should wait for.
--
-- THE SECRET IS NOT IN THIS FILE — same arrangement as 0019: the sweep functions
-- share the project-wide SWEEP_SECRET, read back here from Supabase Vault under
-- the name `speaking_sweep_secret` (created once per environment).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('expired-attempt-sweep')
where exists (select 1 from cron.job where jobname = 'expired-attempt-sweep');

select cron.schedule(
  'expired-attempt-sweep',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://ktxharmjdgkfxkoiymhd.supabase.co/functions/v1/sweep-expired-attempts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sweep-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'speaking_sweep_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);
