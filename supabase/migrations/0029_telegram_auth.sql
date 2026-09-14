-- Telegram sign-up and password reset.
--
-- A student fills the sign-up form, the site opens @CefrLy_bot with a one-time
-- link, the student shares their contact in the bot (Telegram hands the bot
-- the REAL number of that account), the bot sends a 6-digit code, and the site
-- exchanges code + form for an account. The phone number is the login.
--
-- Everything here is written only by the telegram-bot / telegram-auth edge
-- functions (service_role). Students can read their own profile row as before;
-- they can NOT write phone, telegram_user_id or father_name (no column grant),
-- exactly like `role` and `plan`.

alter table public.profiles
  add column if not exists father_name text check (char_length(father_name) <= 60),
  add column if not exists phone text,
  add column if not exists telegram_user_id bigint;

-- One account per number. Partial so the many email accounts (phone NULL) are fine.
create unique index if not exists profiles_phone_key on public.profiles (phone) where phone is not null;

create table if not exists public.telegram_auth_requests (
  id uuid primary key default gen_random_uuid(),
  -- sha256 of the random token in the t.me/<bot>?start=<token> link. The raw
  -- token only ever lives in the student's browser and the deep link.
  token_hash text not null unique,
  purpose text not null check (purpose in ('signup', 'reset')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text,
  -- filled by the bot
  telegram_user_id bigint,
  chat_id bigint,
  phone text,
  code_hash text,
  code_expires_at timestamptz,
  code_sent_at timestamptz,
  codes_sent smallint not null default 0,
  attempts smallint not null default 0,
  consumed_at timestamptz
);

create index if not exists telegram_auth_requests_tg_user
  on public.telegram_auth_requests (telegram_user_id, created_at desc);
create index if not exists telegram_auth_requests_ip
  on public.telegram_auth_requests (ip, created_at desc);

-- RLS on, no policies = service_role only. Revoke too: a table in `public`
-- is granted to anon/authenticated by default (see 0028 for why both locks).
alter table public.telegram_auth_requests enable row level security;
revoke all on public.telegram_auth_requests from anon, authenticated;
