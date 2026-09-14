-- "🔑 Get a new password" in @CefrLy_bot. When a student shares their OWN
-- contact, the bot remembers that Telegram-verified number here for a few
-- minutes. The button then resets the password of the account with THAT number
-- only — never a number typed or forwarded — and at most once a minute.
alter table public.telegram_bot_users
  add column if not exists verified_phone text,
  add column if not exists verified_at timestamptz,
  add column if not exists last_password_at timestamptz;
