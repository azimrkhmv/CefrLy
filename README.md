# Cefrly

CEFR (English proficiency) mock-exam and prep platform for Uzbek learners.
**Phase 1**: foundation + the READING section (35 questions, 5 parts, 60 minutes) with
server-side grading and an indicative band (B1 / B2 / C1).

## Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + React Router
- **Backend**: Supabase (Postgres, Auth, Edge Functions)
- **Server state**: TanStack Query · **In-test state**: Zustand
- **Hosting**: Vercel (frontend) + Supabase (database + edge functions)

## Security model (non-negotiable)

The browser **never** receives answer keys or explanations before a test is submitted:

- `tests` table — metadata only; authenticated users can read published rows.
- `test_content` table — full test JSON **including answers**. RLS enabled with **no
  policies**, so only the `service_role` key (edge functions) can read it.
- `get-test` edge function — returns a **sanitized** test: every `answer` and
  `explanation` field stripped; options, optionPool, prompts, passages and
  `thirdOptionLabel` are kept.
- `submit-test` edge function — grades server-side against the real content, stores the
  attempt, and returns results + explanations.
- The `service_role` key lives **only** in Edge Function secrets. The frontend uses only
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then in the **SQL editor** run,
in order:

1. `supabase/migrations/0001_init.sql` — tables + RLS policies
2. `supabase/seed/seed.sql` — sample reading test (35 questions)

### 3. Deploy the edge functions

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy get-test
supabase functions deploy submit-test
```

(`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected into
edge functions automatically — no manual secrets needed.)

### 4. Configure the frontend

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Project Settings -> API)
```

For quick local testing you may want to disable email confirmation in
**Authentication -> Providers -> Email** so sign-ups work instantly.

### 5. Run

```bash
npm run dev
```

Sign up, pick the test on the home page, and take it.

## Reading paper structure (rigid)

| Part | Questions | Layout | Item types |
| ---- | --------- | ------ | ---------- |
| 1 | 1–6 | `cloze_from_text` — inline gaps in a passage | `gap` |
| 2 | 7–14 | `match_texts` — 8 texts ↔ statements A–J (2 unused) | `match` |
| 3 | 15–20 | `match_headings` — paragraphs I–VI ↔ 8 headings (2 unused) | `match` |
| 4 | 21–29 | `passage_questions` — split-pane, order/split varies | `mcq` + `tfng` |
| 5 | 30–35 | `passage_questions` — summary completion + MCQ | `gap` + `mcq` |

**Scoring** (indicative reading band from raw score /35): 28–35 → C1 · 18–27 → B2 ·
10–17 → B1 · 0–9 → below B1.

## Authoring tests

The canonical sample lives at `supabase/seed/reading-test-1.json`. After editing it (or
adding a new test JSON), regenerate the SQL:

```bash
npm run seed:generate
```

The script validates the rigid structure (5 parts, item counts 6/8/6/9/6, layouts, gap
markers matching item ids, answers present in option pools) before writing
`supabase/seed/seed.sql`.

## Project layout

```
src/
  pages/        Home, Login, Test runner, Results
  components/   Layout, ProtectedRoute, test/ (part renderers + item widgets)
  lib/          supabase client, api (edge function calls), auth context
  store/        Zustand in-test answer state
  types/        Item schema v2 (full + sanitized shapes)
supabase/
  migrations/   0001_init.sql (tables + RLS)
  functions/    get-test, submit-test (Deno edge functions)
  seed/         reading-test-1.json (canonical) + seed.sql (generated)
scripts/        generate-seed.mjs
```

## Later phases (not built yet)

Listening / Writing / Speaking sections, the true /75 four-skill average, and the
MilliyMock hand-off (sign-in without re-registering — hook point in `src/lib/auth.tsx`).
