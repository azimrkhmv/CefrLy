-- @CefrLy_bot is Cefrly's official bot now, not only a code sender. It greets
-- every new chat with the welcome videos and a menu — but only ONCE per
-- Telegram account, so someone who returns to reset a password is not sent the
-- same videos again. This table is that memory. Service-role only.

create table if not exists public.telegram_bot_users (
  telegram_user_id bigint primary key,
  chat_id bigint not null,
  first_name text,
  username text,
  first_seen_at timestamptz not null default now(),
  welcomed_at timestamptz,
  last_seen_at timestamptz not null default now()
);

alter table public.telegram_bot_users enable row level security;
revoke all on public.telegram_bot_users from anon, authenticated;
