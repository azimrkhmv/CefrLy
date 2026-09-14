-- Sign-up now asks for the phone number on the form. The website checks it is
-- not already registered BEFORE sending the student to the bot, and stores it
-- here; the bot then only sends a code when the number shared in Telegram is
-- the same one, so the login the student typed is the login they get.
alter table public.telegram_auth_requests
  add column if not exists expected_phone text;
