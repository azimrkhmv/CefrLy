-- Phase 2: slugs for admin routing + three-state status (draft/published/archived)
-- replacing the published boolean. Students may still read metadata of
-- published tests only; answers stay locked in test_content.

alter table public.tests add column slug text;
alter table public.tests add column status text not null default 'draft'
  check (status in ('draft', 'published', 'archived'));

update public.tests set status = case when published then 'published' else 'draft' end;
update public.tests set slug = 'reading-mock-1'
  where id = '00000000-0000-4000-8000-000000000001';
update public.tests set slug = 'test-' || left(id::text, 8) where slug is null;

alter table public.tests alter column slug set not null;
alter table public.tests add constraint tests_slug_unique unique (slug);

drop policy "authenticated users read published tests" on public.tests;
create policy "students read published tests"
  on public.tests for select
  to authenticated
  using (status = 'published');

alter table public.tests drop column published;
