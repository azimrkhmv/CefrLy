-- Close the sample_prompts view to signed-out visitors.
--
-- 0022 granted the view to `authenticated` only, but a VIEW has no row level
-- security of its own and Supabase's public-schema defaults also reach `anon`.
-- Verified against production: a plain GET with the publishable key, with no
-- user signed in, returned every published prompt.
--
-- Nothing paid leaked (the view already strips model answers, vocab and the
-- analysis), but the question bank should not be scrapeable before login.
--
-- RULE FOR ANY FUTURE VIEW IN `public`: it bypasses RLS and is exposed to anon
-- unless you revoke it. Grant to `authenticated`, revoke from `anon`, always.

revoke all on public.sample_prompts from anon;
grant select on public.sample_prompts to authenticated;
