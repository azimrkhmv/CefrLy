-- Writing/Speaking SAMPLES (model answers for the two untested skills).
--
-- Security model: unlike tests, a sample has NO secret — the model answer IS
-- the content students came to read. So published rows are directly readable
-- by signed-in students (plain RLS select, no sanitizing edge function).
-- Writes stay locked: RLS has no insert/update/delete policies, so only the
-- service_role key — i.e. the admin-samples edge function, which re-checks
-- profiles.role — can author content.

create table public.samples (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  -- the three catalog tabs; a sample lives in exactly one
  category   text not null check (category in ('writing1', 'writing2', 'speaking')),
  badge      text not null,   -- e.g. "Task 1 · Informal letter"
  title      text not null,
  -- { task: string[], bullets?: string[], note: string,
  --   model: string[] (writing paragraphs) | {speaker,text}[] (speaking turns),
  --   why: string[] }  — validated server-side in admin-samples/validate.ts
  content    jsonb not null,
  status     text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index samples_category_order_idx on public.samples (category, sort_order, created_at);

alter table public.samples enable row level security;

create policy "students read published samples"
  on public.samples for select
  to authenticated
  using (status = 'published');

-- no write policies on purpose: admin-samples (service_role) only.
