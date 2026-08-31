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

-- `authenticated` had the full set (INSERT/UPDATE/DELETE/TRUNCATE) here too,
-- from the same defaults. The view is not auto-updatable, so those writes would
-- have failed anyway — but a read-only window should be granted read-only.
revoke all on public.sample_prompts from anon;
revoke all on public.sample_prompts from authenticated;
grant select on public.sample_prompts to authenticated;
