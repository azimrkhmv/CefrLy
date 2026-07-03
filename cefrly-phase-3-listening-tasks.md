# Cefrly — Phase 3: Listening — Task List for Claude Code

**You are Claude Code. Execute this entire phase autonomously, task by task, in order.**
This adds the **Listening** skill: audio-based tests that students take and that are auto-graded,
plus Listening support in the admin dashboard. It reuses the Reading spine almost entirely.

═══════════════════════════════════════════════════════════════════════
GROUND RULES (read before Task 1 — these prevent drift)
═══════════════════════════════════════════════════════════════════════
1. **Read `CLAUDE.md` and the existing codebase first.** REUSE the Reading spine — the same
   renderer shell, timer, mark-for-review, autosave, results page, `get-test` / `score-attempt`
   pattern, and the admin `admin-tests` function. Do NOT rebuild any of that and do NOT invent new
   plumbing, folders, table names, or a parallel "seed" system.
2. **Listening only.** Do NOT touch Writing / Speaking. Do NOT change Reading behavior except where
   a task explicitly says to generalize shared code.
3. **Work in order.** After each task, run its **Acceptance check**. Only continue when it passes.
   Then `git commit` (`phase3: task N - <summary>`).
4. **Security invariant (unchanged):** the browser NEVER reads/writes the `tests` table directly;
   answers are stripped by `get-test`; grading is server-side in `score-attempt`. Frontend uses only
   `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; `service_role` stays in Edge secrets.
5. **Never weaken validation.** Reject malformed listening tests with clear messages; never silently fix.
6. **Be autonomous.** Only pause if truly blocked (a missing secret, or needing a real audio file to
   test with — see Task 3). State the blocker in one line.
7. **Apply DB/storage changes** via the linked Supabase CLI where possible; if not, print exact
   steps/SQL and pause once.

═══════════════════════════════════════════════════════════════════════
CONTEXT — what already exists (extend, don't recreate)
═══════════════════════════════════════════════════════════════════════
**Stack:** Vite + React + TypeScript + Tailwind + React Router + TanStack Query; Supabase; Vercel.

**Reading is fully working:** schema-v2 Reading tests render via a template player, timer + mark-for-review
+ autosave, submit → `score-attempt` → results with explanation cards. Admin dashboard (Phase 2) creates/
edits/publishes tests through a template form, with roles (student / admin / super_admin) and the
`admin-tests` + `admin-users` Edge Functions.

**Tables:** `profiles(…role)`, `tests(id, slug, skill, title, content jsonb, status, created_at)`,
`attempts(…)`, view `test_catalog` (published only). `tests.skill` already distinguishes `'reading'` vs
`'listening'` — USE IT.

**Existing Edge Functions:** `get-test` (strips answers), `score-attempt` (grades, returns band +
explanations), `admin-tests` (list/get/upsert/setStatus/archive, `requireAdmin`), `admin-users`
(super-admin only).

**Band mapping (per skill, raw correct /35):** 28–35 → C1 · 18–27 → B2 · 10–17 → B1 · 0–9 → below_B1.
Label the result an **indicative listening band** (the true 4-skill /75 average is a later phase).

**Reading item types already implemented:** `gap`, `match`, `mcq`, `tfng`. Listening reuses these plus
adds audio at the part level (see schema below).

═══════════════════════════════════════════════════════════════════════
LISTENING SCHEMA (schema v2 — Listening variant; add to CLAUDE.md in Task 1)
═══════════════════════════════════════════════════════════════════════
The Multilevel Listening paper is rigid: **6 parts, 35 questions, ~45 minutes, each recording played
twice, with preview time before each part.** Like Reading, this reduces to a small set of fixed layouts.

```
ListeningTest = { id, skill:'listening', targetLevels:['B1','B2','C1'], durationSec:2700, parts:Part[6] }
Part = {
  id, number:1|2|3|4|5|6,
  layout: 'mcq_audio' | 'matching_audio' | 'form_completion' | 'note_completion' | 'sentence_completion',
  instructions,
  audio: { assetPath:string, playLimit:2, previewSec:number },   // assetPath = file in Supabase 'audio' bucket
  transcript?: string,                                           // SERVER-ONLY, never sent to browser
  optionPool?: {key,label}[],                                    // for matching_audio
  items: Item[]                                                  // ordered
}
Item = same four types as Reading:
 | { id, type:'mcq',  points:1, prompt, options:{key,label}[], answer, explanation }
 | { id, type:'match',points:1, prompt, answer /*optionPool key*/, explanation }
 | { id, type:'gap',  points:1, answer:string[], caseSensitive?:false, explanation }   // completion blanks
 | { id, type:'tfng', points:1, prompt, thirdOptionLabel, answer, explanation }
explanation = { location, quote, reasoning }   // quote = the relevant line from the transcript
```
**Fixed layouts / rendering:**
- `mcq_audio`: play the part's audio; render `mcq` items as radio groups.
- `matching_audio`: play audio; each `item.prompt` gets a dropdown of the part's `optionPool`.
- `form_completion` / `note_completion` / `sentence_completion`: play audio; render a form/notes/sentences
  block with `gap` inputs (typed answers, normalized trim+lowercase like Reading).
Part-count target: distribute 35 questions across the 6 parts (e.g. 6/6/6/7/5/5 — the exact split can vary
per test, so DON'T hard-code it; validate the total instead).

═══════════════════════════════════════════════════════════════════════
TASKS
═══════════════════════════════════════════════════════════════════════

## Task 1 — Schema + shared types
**Goal:** the Listening schema is defined and shared, without breaking Reading.
**Build:**
- Add the Listening variant above to `CLAUDE.md` (under schema v2, next to Reading).
- In `src/types`, add the Listening types. Generalize the shared `Test` type so `skill` drives which
  variant applies; keep Reading types intact. Reuse the four Item types (don't duplicate them).
**Acceptance:** the project type-checks; Reading types/behavior unchanged; Listening types importable.
**Then commit.**

## Task 2 — Audio storage
**Goal:** a place to store listening audio, readable by students, writable only by admins.
**Build:**
- Create a Supabase Storage bucket `audio`.
- Policies: public READ (audio isn't secret and needs to stream to students); WRITE/UPLOAD restricted to
  `admin`/`super_admin` (check role), or handled via an admin Edge Function if simpler — never open write to all.
- Add a small helper to resolve an `assetPath` to a playable public URL on the frontend.
**Acceptance:** a file placed in `audio` streams via its public URL in the browser; a non-admin cannot upload.
**Then commit.**

## Task 3 — Seed one Listening test (fixture for everything below)
**Goal:** one real Listening test in the DB to build and test against.
**Build:**
- Generate ONE original schema-v2 Listening test: 6 parts across the fixed layouts, 35 items total, answer
  keys, transcripts, and explanation cards. Original content only — never copy real exam audio/scripts.
- You need at least one real audio file to test playback. If none is available, **pause once** and ask the
  owner to drop an MP3 into the `audio` bucket (or approve using a short text-to-speech clip you generate for
  testing); wire the test's `assetPath`(s) to it. Placeholder silence is acceptable for wiring/QA if the
  owner prefers — note it clearly.
- Insert via `admin-tests`→`upsert` (once Task 6 exists) OR, to unblock earlier, a dollar-quoted SQL insert
  (`$json$ … $json$::jsonb`) with `skill='listening'`, `status='draft'`.
**Acceptance:** a Listening test row exists with `skill='listening'`; its `content` passes the Task 5 validator.
**Then commit.**

## Task 4 — The four-slot audio player component
**Goal:** the listening-specific playback UI, reusable and rule-enforcing.
**Build:**
- An audio player component: **one player slot per part** (the "four-slot" design generalized to the part
  count). For each part it:
  - loads the part's audio from the `audio` bucket via `assetPath`;
  - enforces `playLimit` (e.g. 2) — after the limit, play is disabled;
  - shows a `previewSec` countdown BEFORE the first play, during which questions are visible but audio is locked;
  - shows clear state: preview / playing / plays remaining / locked.
- Fully responsive; works on mobile (tap to play, visible controls). No autoplay surprises.
**Acceptance:** in isolation (a test harness or the player page), audio plays up to the limit then locks; the
preview countdown gates the first play; state is clear; works on a phone-width viewport.
**Then commit.**

## Task 5 — Listening in the delivery + grading path
**Goal:** a student can take the Listening test end-to-end and get scored — reusing the Reading spine.
**Build:**
- **Renderer:** extend the existing test player so that when `skill='listening'`, each part renders its audio
  player (Task 4) above that part's questions, then renders items by the listening layouts. Reuse the SAME
  timer, mark-for-review, question navigator, and autosave-to-`attempts` already built for Reading.
- **`get-test`:** ensure it also strips `transcript` (and every `answer`/`explanation`) for listening tests,
  while KEEPING `audio` (assetPath/playLimit/previewSec), `optionPool`, prompts, options. The browser must
  never receive transcripts or answers pre-submit.
- **`score-attempt`:** generalize grading to listening items (same per-type rules as Reading: gap = normalized
  text; match/mcq = key equals answer; tfng = selection equals answer; 1 mark each; total /35 → band). It
  should already be close — make it skill-agnostic, not Reading-only.
- **Results page:** reuse it; for listening, the explanation `quote` comes from the transcript. Optionally show
  the transcript on the results page AFTER submit (nice-to-have; keep it behind submit).
**Acceptance:** open the seeded Listening test as a student → preview timers and play limits work → answer across
all 6 parts → autosave survives refresh → submit → get an indicative listening band /35 with explanation cards.
Verify in the network tab that NO transcript or answer reached the browser before submit.
**Then commit.**

## Task 6 — Listening in the admin template form
**Goal:** admins can create/edit Listening tests through a form, like Reading.
**Build:**
- Extend the admin form (Phase 2) to support `skill='listening'`: pick skill on "New test"; render a fixed
  template for the 6 listening parts and their layouts.
- Per part: an **audio upload** (into the `audio` bucket, admin-only) that sets `assetPath`; `playLimit`
  (default 2) and `previewSec`; a `transcript` field; the part's items per its layout (mcq / match+optionPool /
  completion gaps) with answers + explanations.
- Live client-side validation MIRRORING the server: total = 35 items across 6 parts; every part has audio;
  every `gap` has an answer; every `match` answer exists in the part's `optionPool`; every `mcq` answer exists
  in its options; every `tfng` valid. Server (`admin-tests`→`upsert`) stays the source of truth — extend its
  validator to handle `skill='listening'` with these rules.
- Save assembles the Listening schema-v2 object and calls `upsert` (draft). Reuse the Reading edit/publish flow.
**Acceptance:** create a new Listening test entirely through the form → it passes server validation → renders and
scores in the student player (Task 5). Editing the seeded test prefills correctly. An incomplete form surfaces
exact server errors and writes nothing.
**Then commit.**

## Task 7 — Home/catalog + dashboard reflect two skills
**Goal:** students can find and distinguish Reading vs Listening tests, and see their history across both.
**Build:**
- Student home / test catalog: show skill (Reading / Listening) clearly on each test card; optionally allow
  filtering by skill. Reuse `test_catalog`.
- Attempt-history/dashboard: list past attempts across BOTH skills (test title, skill, date, band, score),
  newest first, each linking to its results page. (If the dashboard doesn't exist yet from Phase 1, build a
  simple version now.)
**Acceptance:** a published Listening test appears on the home labeled Listening; a student who took both a
Reading and a Listening test sees both in history with correct skill + band.
**Then commit.**

## Task 8 — End-to-end verification + polish
**Goal:** prove the whole Listening loop and tidy up.
**Verify (no files, no SQL editor, using the admin UI):**
- As admin: New Listening test → upload audio → fill 6 parts → Save (draft) → fix any validation errors →
  preview in the student player → Publish → confirm it appears on the home as Listening, plays with the
  correct limits/preview, and scores.
- Mobile: the audio player and all listening layouts are usable on a phone.
- Security (network tab): no transcript/answers before submit; browser never touches `tests` or uploads audio
  outside the admin-gated path.
**Acceptance (Phase 3 Definition of Done):**
- [ ] Listening schema v2 defined and shared; Reading unchanged.
- [ ] `audio` bucket: public read, admin-only write; assetPath → playable URL.
- [ ] Four-slot audio player: per-part playback, playLimit enforced, preview countdown, mobile-friendly.
- [ ] Student can take a Listening test end-to-end (timer, mark-for-review, autosave) and get an indicative /35 band.
- [ ] `get-test` strips transcripts + answers for listening; `score-attempt` grades listening skill-agnostically.
- [ ] Admin can create/edit/publish Listening tests through the template form (with audio upload) + server validation.
- [ ] Home distinguishes Reading vs Listening; history spans both skills.
- [ ] No transcripts/answers reach the browser pre-submit; browser never writes tests/audio directly.
**Then commit** (`phase3: complete - listening`).

═══════════════════════════════════════════════════════════════════════
OUT OF SCOPE (later phases)
═══════════════════════════════════════════════════════════════════════
Writing/Speaking; combining Reading+Listening into one full timed mock (Phase 4); analytics/progress
charts; prep/learning mode; AI grading. When Listening is done and committed, stop and report what was built.
