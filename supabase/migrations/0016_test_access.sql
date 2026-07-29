-- Free vs Premium tests (2026-07-29).
--
-- A test is either 'free' (open to EVERY signed-in user, unlimited, forever — no
-- plan, no counting, no monthly reset) or 'premium' (only Pro/Premium plans,
-- subject to the pricing-page monthly caps: Pro limited, Premium unlimited; a
-- free-plan user can't open it at all). This replaces the earlier model where
-- free users had small monthly allowances — free-test usage now counts toward
-- NOTHING; the only thing that resets monthly is the paid subscription (its
-- expiry + Pro's premium-test caps, which ride the subscription month).
--
-- Enforcement lives in start-session (server-side). Default 'premium' so every
-- existing test locks to paid by default; the owner flips the "free taster" set
-- to 'free' from /admin/tests.

alter table public.tests
  add column if not exists access text not null default 'premium'
    check (access in ('free', 'premium'));
