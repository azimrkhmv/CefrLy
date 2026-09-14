-- Phone-only accounts (owner's call, 2026-09-14).
--
-- Every account is now created by the telegram-auth edge function with the
-- service role. Public sign-up is switched OFF in the Auth settings
-- (disable_signup = true; the admin API used by telegram-auth is not affected),
-- so the dev-only auto-confirm trigger has nothing left to do — and left in
-- place it would silently confirm any account if sign-up were ever re-enabled.
drop trigger if exists auto_confirm_on_signup on auth.users;
drop function if exists public.auto_confirm_user();

-- One-off data changes run with this migration on production, recorded here:
--   · +998 90 508 39 95 made super_admin.
--   · All 58 email accounts deleted (cascade removed their attempts, sessions,
--     speaking/writing attempts and plan history). A JSON backup was taken first
--     to the gitignored backups/2026-09-14-email-accounts/ folder.
