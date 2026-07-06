# Cefrly — Phase 3: Listening — Task List for Claude Code

**You are Claude Code. Execute this entire phase autonomously, task by task, in order.**
This adds the **Listening** skill. Its format was derived from REAL Multilevel Listening papers —
build to the fixed structure below exactly, and reuse the Reading spine.

═══════════════════════════════════════════════════════════════════════
GROUND RULES (read before Task 1 — these prevent drift)
═══════════════════════════════════════════════════════════════════════
1. **Read `CLAUDE.md` and the existing codebase first.** REUSE the Reading spine — the same player
   shell, timer, mark-for-review, question navigator, autosave, results page, and the
   `get-test` / `score-attempt` / `admin-tests` patterns. Do NOT rebuild any of that and do NOT invent
   parallel plumbing, folders, table names, or a separate "seed" system.
2. **Listening only.** Do NOT touch Writing / Speaking. Change Reading only where a task explicitly
   says to generalize shared code (e.g. make grading skill-agnostic).
3. **Work in order.** After each task run its **Acceptance check**; continue only when it passes.
   Then `git commit` (`phase3: task N - <summary>`). This phase is large — the owner may run it in
   chunks (Tasks 1–4 backend/audio, 5–6 delivery, 7 admin, 8–9 verify); respect the task boundaries.
4. **Security invariant (unchanged):** the browser NEVER reads/writes the `tests` table directly;
   `get-test` strips answers AND transcripts; grading is server-side in `score-attempt`. Frontend uses
   only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; `service_role` stays in Edge secrets.
5. **Never weaken validation.** Reject malformed listening tests with specific messages; never silently fix.
6. **Original content only.** Generate original items in the fixed structure. NEVER copy/redistribute
   real exam papers verbatim.
7. **Be autonomous.** Only pause if truly blocked (a missing secret, or needing a real audio file — Task 3).

═══════════════════════════════════════════════════════════════════════
CONTEXT — what already exists (extend, don't recreate)
═══════════════════════════════════════════════════════════════════════
**Stack:** Vite + React + TypeScript + Tailwind + React Router + TanStack Query; Supabase; Vercel.
**Reading works:** schema-v2 Reading tests render via a template player (timer, mark-for-review, autosave,
submit → `score-attempt` → results with explanation cards). Admin (Phase 2) creates/edits/publishes tests
through a template form, with roles (student/admin/super_admin) and `admin-tests` + `admin-users` functions.
**Tables:** `profiles(…role)`, `tests(id, slug, skill, title, content jsonb, status, created_at)`,
`attempts(…)`, view `test_catalog` (published only). `tests.skill` already separates `'reading'` / `'listening'`.
**Edge Functions:** `get-test` (strips answers), `score-attempt` (grades, returns band + explanations),
`admin-tests` (list/get/upsert/setStatus/archive, `requireAdmin`), `admin-users` (super-admin only).
**Band mapping (per skill, raw correct /35):** 28–35 → C1 · 18–27 → B2 · 10–17 → B1 · 0–9 → below_B1.
Label the listening result an **indicative listening band** (the true 4-skill /75 average is a later phase).

═══════════════════════════════════════════════════════════════════════
THE REAL LISTENING FORMAT (derived from actual papers — build to this exactly)
═══════════════════════════════════════════════════════════════════════
Six parts, **35 questions**, 1 mark each. Each recording is played **twice**. ~35 min total.
Fixed per-part counts and types (DO NOT change the counts):

- **Part 1 — Q1–8 — layout `mcq_response`:** hear a short prompt/utterance, choose the best REPLY.
  8 items, 3 options each (A/B/C). No written question text — the audio is the prompt.
- **Part 2 — Q9–14 — layout `form_completion`:** a titled form with 6 blanks; type ONE word/number each.
- **Part 3 — Q15–18 — layout `matching`:** match 4 speakers (Speaker 1–4) to an option pool (letters,
  e.g. A–H) with EXTRA options; each option used once.
- **Part 4 — Q19–23 — layout `map_labelling`:** label 5 places on a MAP/PLAN IMAGE using letters (A–H/A–I)
  with EXTRA options. **Requires an image.**
- **Part 5 — Q24–29 — layout `multi_extract_mcq`:** THREE extracts. Each extract has a context line and
  2 MCQs (3 options) = 6 total. **Requires sub-grouping (one group per extract).**
- **Part 6 — Q30–35 — layout `note_completion`:** notes/sentences with 6 blanks; type ONE word each.

Only THREE underlying item types exist in Listening: **`mcq`, `match`, `gap`.** (No `tfng` — that is Reading.)
Gap answers accept MULTIPLE spellings (real keys show "1.30 / one hour and thirty minutes",
"(desert) plants", "twelve/12", "sunrise(s)").

═══════════════════════════════════════════════════════════════════════
LISTENING SCHEMA v2 (add to CLAUDE.md in Task 1)
═══════════════════════════════════════════════════════════════════════
```
ListeningTest = {
  id, skill:'listening', targetLevels:['B1','B2','C1'], durationSec:2400,
  audioMode: 'per_part' | 'single',                    // how audio is supplied (see Task 4)
  singleAudio?: { assetPath, playLimit:2, previewSec }, // REQUIRED iff audioMode='single'
  parts: Part[6]
}
Part = {
  id, number:1|2|3|4|5|6,
  layout: 'mcq_response'|'form_completion'|'matching'|'map_labelling'|'multi_extract_mcq'|'note_completion',
  instructions,
  audio?:  { assetPath, playLimit:2, previewSec },      // REQUIRED per part iff audioMode='per_part'
  image?:  { assetPath, alt },                          // REQUIRED for map_labelling
  optionPool?: {key,label}[],                           // for matching & map_labelling (labels may be just the letter)
  stem?:   { title?, html },                            // for form_completion & note_completion; html holds {{itemId}} gap markers
  groups?: Group[],                                     // for multi_extract_mcq (one per extract)
  items?:  Item[]                                       // for all layouts that don't use groups
}
Group = { id, context, items: Item[] }                  // multi_extract_mcq: context = the extract's intro line
Item =
 | { id, number, type:'mcq',   prompt?, options:{key,label}[], answer:string, explanation }   // prompt optional (Part 1 has none)
 | { id, number, type:'match', prompt,  answer:string /* an optionPool key */, explanation }  // prompt = "Speaker 1" or the place name
 | { id, number, type:'gap',   answer:string[] /* accepted spellings */, explanation }
explanation = { location, quote, reasoning }            // quote = the relevant transcript line (SERVER-ONLY)
```
Optional server-only field: `Part.transcript?: string` — NEVER sent to the browser (strip in `get-test`).

Per-layout item usage: `mcq_response`=8 `mcq` · `form_completion`=6 `gap` in `stem.html` · `matching`=4
`match` + `optionPool` · `map_labelling`=5 `match` + `image` + `optionPool` · `multi_extract_mcq`=3 groups
× 2 `mcq` · `note_completion`=6 `gap` in `stem.html`.

═══════════════════════════════════════════════════════════════════════
TASKS
═══════════════════════════════════════════════════════════════════════

## Task 1 — Schema + shared types
**Goal:** the Listening schema is defined and shared, Reading untouched.
**Build:** add the Listening schema above to `CLAUDE.md` (beside Reading). In `src/types`, add Listening
types; generalize the shared `Test` type so `skill` selects the variant; reuse the `mcq`/`match`/`gap` item
types (Reading keeps `tfng`; Listening does not use it). Do not duplicate item types.
**Acceptance:** project type-checks; Reading types/behavior unchanged; Listening types importable, including
`audioMode`, `groups`, and per-part `image`.
**Then commit.**

## Task 2 — Storage (audio + images)
**Goal:** places to store listening audio and map images; readable by students, writable only by admins.
**Build:** create Supabase Storage buckets `audio` and `images`. Policies: public READ (needed to
stream/display to students); WRITE restricted to `admin`/`super_admin` (or via an admin Edge Function).
Add frontend helpers resolving an `assetPath` to a public URL for each bucket.
**Acceptance:** a file in `audio` streams and a file in `images` displays via their public URLs; a non-admin
cannot upload to either.
**Then commit.**

## Task 3 — Seed one Listening test (fixture)
**Goal:** one real Listening test in the DB to build/test against.
**Build:** generate ONE ORIGINAL schema-v2 Listening test covering all six parts with the exact counts
(8/6/4/5/6/6 = 35), answer keys (gap answers as arrays of accepted spellings), transcripts, and explanation
cards. Include a simple map IMAGE for Part 4 (generate/produce a basic plan and upload to `images`). To test
playback you need real audio: **pause once** and ask the owner to either (a) upload 6 part MP3s (`audioMode:'per_part'`)
or (b) one combined MP3 (`audioMode:'single'`) into the `audio` bucket — or approve short TTS clips for QA.
Wire the fixture's `assetPath`(s) accordingly. Insert via `admin-tests`→`upsert` (after Task 7) or, to unblock
earlier, a dollar-quoted SQL insert (`$json$ … $json$::jsonb`) with `skill='listening'`, `status='draft'`.
**Acceptance:** a `skill='listening'` row exists whose `content` passes the Task 6 validator; the Part 4 image loads.
**Then commit.**

## Task 4 — Audio player (TWO modes)
**Goal:** the listening playback UI, supporting both ways audio arrives, enforcing the exam rules.
**Build:**
- **`per_part` mode:** ONE player per part, loading that part's `audio.assetPath`; enforce `playLimit` (2 →
  disable after two plays); show a `previewSec` countdown BEFORE the first play (questions visible, audio locked).
- **`single` mode:** ONE player at the top of the section for `singleAudio.assetPath`; enforce its `playLimit`
  and `previewSec`; no per-part gating (the pauses are baked into the file).
- Clear state in both: preview / playing / plays remaining / locked. Responsive; works on mobile; no autoplay.
**Acceptance:** in `per_part`, each part plays up to its limit then locks and the preview gates the first play;
in `single`, one player governs the whole section; both work on a phone-width viewport.
**Then commit.**

## Task 5 — The six layout renderers + delivery path
**Goal:** a student can take the Listening test end-to-end, reusing the Reading spine.
**Build a renderer for each fixed layout, wired into the existing test player** (when `skill='listening'`,
render the audio (Task 4) then the part by its layout):
- `mcq_response` (Part 1): 8 numbered items, each 3 radio options (A/B/C); no prompt text.
- `form_completion` (Part 2): render `stem.html` as a form, replacing each `{{itemId}}` with a text input.
- `matching` (Part 3): list each speaker item; a dropdown of the part's `optionPool` per item (extras included).
- `map_labelling` (Part 4): show the `image`; list each place-name item with a dropdown of map letters (`optionPool`, extras).
- `multi_extract_mcq` (Part 5): render each `group` as an extract block — its `context` line then its 2 MCQs.
- `note_completion` (Part 6): render `stem.html` as notes, replacing each `{{itemId}}` with a text input.
Reuse the SAME timer, mark-for-review, question navigator (1–35), and autosave-to-`attempts` from Reading.
**Acceptance:** open the seeded Listening test as a student → audio rules work → all six parts render correctly
(including the Part 4 map and the Part 5 extract grouping) → autosave survives refresh → the navigator covers 1–35.
**Then commit.**

## Task 6 — `get-test` + `score-attempt` for Listening
**Goal:** listening tests are served safely and graded correctly.
**Build:**
- **`get-test`:** for listening, strip every `answer`, `explanation`, AND `transcript`, while KEEPING `audio`
  (all fields), `image`, `optionPool`, `stem.html` (with `{{itemId}}` markers), `groups[].context`, prompts, options.
  The browser must never receive answers or transcripts pre-submit.
- **`score-attempt`:** make grading skill-agnostic. Listening items: `mcq`/`match` → selected key equals `answer`;
  `gap` → normalized typed answer (trim + lowercase) matches ANY string in `answer[]`. 1 mark each; total /35 → band.
  Handle grouped items (Part 5) by flattening groups' items. Results page reuses Reading's; explanation `quote`
  comes from the transcript and is shown only AFTER submit.
**Acceptance:** submit the seeded listening test → correct /35 and indicative band; a gap with an alternate
accepted spelling is marked right; grouped Part 5 items score correctly; network tab shows NO answers/transcripts
reached the browser before submit.
**Then commit.**

## Task 7 — Listening in the admin template form (with dual audio upload)
**Goal:** admins create/edit Listening tests through a fixed-template form, like Reading.
**Build:** extend the Phase 2 admin form for `skill='listening'`:
- **Audio mode toggle:** choose `per_part` (show 6 audio-upload slots, one per part) or `single` (show one
  audio-upload for the whole section). Uploads go to the `audio` bucket (admin-only) and set the `assetPath`(s),
  plus `playLimit` (default 2) and `previewSec` per uploaded audio.
- **Six fixed layout sub-forms**, matching the parts:
  - Part 1 `mcq_response`: 8 items × 3 options + correct key + explanation (prompt field optional).
  - Part 2 `form_completion`: form `stem` editor with `{{q9}}`…`{{q14}}` markers; 6 gap rows with accepted
    answers (allow MULTIPLE accepted spellings per gap) + explanation.
  - Part 3 `matching`: `optionPool` editor (letters + labels, with extras); 4 speaker items → correct key + explanation.
  - Part 4 `map_labelling`: **image upload** (to `images`, admin-only) + `optionPool` of map letters; 5 place-name
    items → correct letter + explanation.
  - Part 5 `multi_extract_mcq`: 3 extract groups, each: `context` line + 2 MCQs (3 options + correct key + explanation).
  - Part 6 `note_completion`: notes `stem` editor with `{{q30}}`…`{{q35}}` markers; 6 gap rows (multiple accepted
    spellings) + explanation.
- Live client-side validation MIRRORING the server. **Extend `admin-tests`→`upsert` server validation for
  `skill='listening'`:** exactly 6 parts with the fixed layouts in order; per-part counts 8/6/4/5/6/6 (total 35);
  every `gap` has ≥1 accepted answer; every `match` answer exists in its part's `optionPool`; every `mcq` answer
  exists in its options; `map_labelling` has an `image`; audio present per `audioMode` (each part in `per_part`,
  or `singleAudio` in `single`); every `{{itemId}}` marker has a matching `gap` item. On failure return
  `{ok:false, errors:[...]}` and write nothing.
- Save assembles the Listening schema-v2 object and calls `upsert` (draft). Reuse the Reading edit/publish flow.
**Acceptance:** create a NEW Listening test entirely through the form (both audio modes tried) → it passes server
validation → renders and scores in the student player (Tasks 5–6). Editing the seeded test prefills all six parts
(image + groups included). An incomplete form surfaces the exact server errors and writes nothing.
**Then commit.**

## Task 8 — Home/catalog + dashboard across both skills
**Goal:** students find and distinguish Reading vs Listening, and see history across both.
**Build:** on the student home/catalog, label each test's skill (Reading / Listening) and optionally allow
filtering by skill (reuse `test_catalog`). The attempt-history/dashboard lists attempts across BOTH skills
(title, skill, date, band, score), newest first, each linking to its results page (build a simple dashboard now
if one doesn't exist yet).
**Acceptance:** a published Listening test appears on the home labeled Listening; a student who took both a
Reading and a Listening test sees both in history with correct skill + band.
**Then commit.**

## Task 9 — End-to-end verification + polish
**Goal:** prove the whole Listening loop and tidy up.
**Verify (no files, no SQL editor, using the admin UI):** as admin → New Listening test → choose audio mode →
upload audio (+ Part 4 map image) → fill all six parts → Save (draft) → fix any validation errors → preview in
the student player → Publish → confirm it appears as Listening, plays with the correct limits/preview, and scores.
Check mobile: audio player, the map, the extract groups, and all inputs are usable on a phone. Check the network
tab: no answers/transcripts before submit; the browser never touches `tests` or uploads media outside the admin path.
**Acceptance (Phase 3 Definition of Done):**
- [ ] Listening schema v2 defined and shared; Reading unchanged; no `tfng` in listening.
- [ ] `audio` + `images` buckets: public read, admin-only write; assetPath → URL helpers.
- [ ] Audio player supports BOTH `per_part` (per-part players, playLimit, preview) and `single` (one player); mobile-friendly.
- [ ] All six layouts render correctly, incl. Part 4 map image and Part 5 three-extract grouping.
- [ ] Student can take a Listening test end-to-end (timer, mark-for-review, navigator 1–35, autosave) → indicative /35 band.
- [ ] `get-test` strips answers + transcripts for listening; `score-attempt` grades listening (gap = multiple accepted spellings).
- [ ] Admin can create/edit/publish Listening tests through the template form, with dual audio upload + image upload + server validation.
- [ ] Home distinguishes Reading vs Listening; history spans both skills.
- [ ] No answers/transcripts reach the browser pre-submit; browser never writes tests/media directly.
**Then commit** (`phase3: complete - listening`).

═══════════════════════════════════════════════════════════════════════
OUT OF SCOPE (later phases)
═══════════════════════════════════════════════════════════════════════
Writing/Speaking; combining Reading+Listening into one full timed mock (Phase 4); analytics/progress; prep mode;
AI grading. When Listening is done and committed, stop and report what was built.
