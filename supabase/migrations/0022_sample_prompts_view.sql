-- Separate the QUESTIONS from the ANSWERS.
--
-- Migration 0020 put the whole samples library behind Pro/Premium. That was
-- right for the model answers — but the speaking exam is BUILT from these rows,
-- so it also emptied the speaking catalog for every free account. Free students
-- saw "No speaking mock published yet".
--
-- The prompt a student is asked is not the paid part. This view publishes the
-- question side to everyone and keeps the answer side paid:
--
--   published here  — task text, bullets, photos, and (speaking) the EXAMINER's
--                     turns, which are the only place the source records the
--                     questions for Part 1.1
--   still paid      — the Student's model answers, the vocabulary glossary and
--                     the "why this scores well" analysis
--
-- The view deliberately runs with the owner's rights (security_invoker stays
-- off), so it can read `samples` past that table's premium policy. That is the
-- entire point: it is a narrowed window onto the same rows.

create or replace view public.sample_prompts as
select
  s.id,
  s.slug,
  s.category,
  s.badge,
  s.title,
  jsonb_set(
    s.content - 'vocab' - 'why',
    '{model}',
    coalesce(
      (
        select jsonb_agg(turn)
        from jsonb_array_elements(s.content -> 'model') as turn
        -- Speaking models are {speaker,text} turns; the examiner's are the
        -- questions. Writing models are plain strings with no speaker, so this
        -- yields nothing and their model answer stays paid, as it should.
        where turn ? 'speaker' and turn ->> 'speaker' ilike 'examiner'
      ),
      '[]'::jsonb
    )
  ) as content
from public.samples s
where s.status = 'published';

comment on view public.sample_prompts is
  'Published samples with the model answers, glossary and analysis stripped out. Feeds the speaking exam, which is generated from these prompts and must work on every plan. The full rows stay behind has_premium_access().';

grant select on public.sample_prompts to authenticated;
