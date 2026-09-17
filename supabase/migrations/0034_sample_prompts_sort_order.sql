-- Expose sort_order on the sample_prompts view.
--
-- The WRITING exam is now built from the samples library too (it was a
-- hard-coded fixtures file, so a new paper meant a code deploy). A writing mock
-- needs three samples that belong together — Task 1.1 and Task 1.2 share one
-- scenario — and the samples table has no "paper" column. sort_order is the
-- link: writing paper N = the published writing1_1, writing1_2 and writing2
-- samples whose sort_order is N. It is already editable in the admin console.
--
-- CREATE OR REPLACE VIEW may only APPEND columns, so sort_order goes last; the
-- existing grants (authenticated select only, 0023) are kept by a replace.

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
  ) as content,
  s.sort_order
from public.samples s
where s.status = 'published';
