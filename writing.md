# Cefrly — Writing Section PRD

**Status:** the UI-first phase is built and browser-verified (running on local fixtures +
localStorage). This is the **single authoritative PRD** for the whole Writing feature — the built UI,
the remaining backend, and the **AI grading built on the official Multilevel writing rubric**.
It supersedes the earlier `cefrly-phase-4-writing-prd.md` (now deleted to avoid confusion).

Source of truth for scoring (in the repo): `Writing criteria multilevel.pdf` (per-task band
descriptors) and `Chet tili (multilevel) baholash mezonlari - yangi.pdf` (weights + the /36→/75
conversion + CEFR thresholds). **These PDFs are the grader's rubric — feed them into the grading
prompt verbatim.**

---

## 1. Decisions (locked with the owner)

| Area | Decision |
|---|---|
| **Grading** | **AI grading**, automated. Model/provider **TBD (owner will share)** — build provider-agnostic. |
| **Result** | Overall **0–75 score** + CEFR band, computed with the **official rubric + conversion** (§4). |
| **Feedback depth** | **Full**: per-task 0–9 bands on the 4 official criteria + strengths/fixes + **inline corrections**. |
| **Feedback language** | **English only.** |
| **Backend** | **Supabase** — tests, custom questions, attempts + grades stored server-side. |
| **Custom questions** | **DB, per user** (synced across devices). |
| **Access** | **Subscription with a per-package essay quota.** Free/unlimited for now; owner tunes limits. |
| **My Results** | **Show writing history** (0–75 + band), kept off the Reading/Listening CEFR ruler. |
| **Authoring** | **Admin form** + a **bulk "upload all tests via Claude"** import path. |
| **Mock timing** | **Separate timer per task.** |
| **Handwriting** | **No** — typed answers only. |
| **Word count** | **Guidance only** (the rubric already penalises underlength; no hard block). |

### Task structure — DECIDED: keep 3 tasks
Cefrly keeps **3 tasks — Task 1.1, Task 1.2, Task 2** — mapped onto the official 2 scoring buckets:
- **Task 1.1 + Task 1.2** together = the official **"Task 1"** bucket (**12 pts / 33%**).
- **Task 2** (the essay) = the official **"Task 2"** (**24 pts / 67%**).

Proposed split of the 12-pt bucket: **Task 1.1 = 4 pts, Task 1.2 = 8 pts** (the formal ~150-word 1.2
matches the official Task-1 letter descriptor, so it carries more; owner can adjust to e.g. 6 + 6).
Total raw = 4 + 8 + 24 = **36**, which feeds the /36→/75 conversion unchanged. See §3/§4.

### Smaller items to confirm
- The **1.1 / 1.2 sub-split** of the 12-pt bucket (default 4 + 8 above).
- How the 4 criteria combine into one task band (mean of the four, vs a holistic band) + rounding.
- The AI model/provider (owner to share).
- Official per-task minutes for the timers.
- Essay-quota numbers per subscription tier.

---

## 2. The writing format (Multilevel)

Current Cefrly tabs: `Mock Test · Task 1.1 · Task 1.2 · Task 2 · Custom Question`.
- **Task 1.1** — informal email, ~B1, ~50 words.
- **Task 1.2** — formal email (shares Part 1's scenario with 1.1), ~B2, ~120–150 words.
- **Task 2** — essay / forum post, ~C1, ~180–200 words (official Task 2 target ~250 words).

No charts/maps. An optional context image is allowed, never required.

---

## 3. Task structure — 3 tasks → 2 official scoring buckets

Cefrly keeps its **3 tasks**; each is graded on the official 0–9 rubric, and their weighted points sum
into the official 2-bucket total (max **36**):

| Cefrly task | What it is | Word target | 0-mark under | Weight | Official bucket |
|---|---|---|---|---|---|
| **Task 1.1** | informal email | ~50 words | < 20 words | **4 pts** | Task 1 (12) |
| **Task 1.2** | formal email (~the official Task-1 letter) | ~120–150 words | < 20 words | **8 pts** | Task 1 (12) |
| **Task 2** | academic essay (thesis, intro/body/conclusion) | ~250 words | < 40 words | **24 pts** | Task 2 (24) |

- Which official rubric applies: **Task 1.1 & Task 1.2 use the "Task 1" descriptors** (letter/email,
  content points); **Task 2 uses the "Task 2" descriptors** (essay). Word-count/underlength thresholds
  are per the actual task length (a 50-word informal email isn't judged against the 150-word letter caps).
- The **4 + 8 split** of the 12-pt bucket is the proposed default (owner may set 6 + 6, etc.).
- `raw = p(1.1) + p(1.2) + p(2)`, each `p = (band/9)×weight`, max `4+8+24 = 36` → §4.3 table → /75.

---

## 4. Official scoring model (precise — from the two PDFs)

### 4.1 Per-task rubric (`Writing criteria multilevel.pdf`)
Each task is scored **0–9** against **four criteria**:
1. **Task achievement**
2. **Grammar range and accuracy**
3. **Vocabulary range and appropriacy**
4. **Coherence and cohesion**

CEFR anchors on the band scale: **9 = C1 · 7 = B2 · 5 = B1** (8/6/4 = "shares features of the bands
above/below"; 3–2 below B1; 0 = fail conditions). Full descriptors for every band × criterion are in
the PDF — that text IS the grader's rubric.

**Zero-mark conditions** (whole task = 0): not written · completely off-topic · fully
plagiarized/memorized · under **20 words** (Task 1) / **40 words** (Task 2).

**Underlength band-caps** (word count limits the achievable band):
- Task 1 (~150w full): 121–135w ≈ Band 7 ceiling · 91–120w ≈ Band 5 · 61–90w ≈ Band 3.
- Task 2 (~250w full): 188–225w ≈ Band 7 ceiling · 125–187w ≈ Band 5 · 76–125w ≈ Band 3.

### 4.2 Weighting → raw /36 (`baholash mezonlari`)
- Official buckets: **Task 1 = 12 pts (33%)**, **Task 2 = 24 pts (67%)**; raw total = **0–36**.
- Cefrly's 3 tasks carry weights **Task 1.1 = 4, Task 1.2 = 8, Task 2 = 24** (see §3; the 4 + 8 fills
  the 12-pt Task-1 bucket).
- Per task: `task_points = (task_band / 9) × task_weight`.
  - e.g. Task 1.2 band 7 → 7/9×8 = 6.22 pts; Task 2 band 5 → 5/9×24 = 13.33 pts.
- `raw = p(1.1) + p(1.2) + p(2)`  (max 36).

### 4.3 Raw /36 → final /75 (official lookup table)
The agency converts the raw expert average to a final /75. Store this as a lookup constant:
```
36.0–35.1→75  35.0–34.1→74  34.0–33.1→73  33.0–32.6→72  32.5–32.1→71  32.0–31.6→70
31.5–31.1→69  31.0–30.6→68  30.5–30.1→67  30.0–29.1→66  29.0–28.1→65  28.0–27.1→64
27.0–26.6→63  26.5–26.1→62  26.0–25.6→61  25.5–25.1→60  25.0–24.6→59  24.5–24.1→58
24.0–23.6→57  23.5–23.1→56  23.0–22.6→55  22.5–22.1→54  22.0–21.6→53  21.5–21.1→52
21.0–20.6→51  20.5–20.1→50  20.0–19.6→49  19.5–19.1→48  19.0–18.6→47  18.5–18.1→46
18.0–17.6→45  17.5–17.1→44  17.0–16.6→43  16.5–16.1→42  16.0–15.6→41  15.5–15.1→40
15.0–14.6→39  14.5–14.1→38  14.0–13.6→37  13.5–13.1→36  13.0–12.6→35  12.5–12.1→34
12.0–11.6→33  11.5–11.1→32  11.0–10.6→31  10.5–10.1→30  10.0–9.6→29   9.5–9.1→28
9.0–8.6→27    8.5–8.1→26    8.0–7.6→25    7.5–7.1→24    7.0–6.6→23    6.5–6.1→22
6.0–5.6→21    5.5–5.1→20    5.0–4.6→19    4.5–4.1→18    4.0–3.6→17    3.5–3.1→16
3.0–2.6→15    2.5–2.1→14    2.0–1.6→13    1.5–1.1→12    1.0–0.6→11    0.5–0.1→10
(0 → below the table)
```
Writing section max = **75**.

### 4.4 Final /75 → CEFR band
| Band | /75 score | (L&R raw-correct proxy /35) |
|---|---|---|
| **C1** | 65–75 | 28–35 |
| **B2** | 51–64 | 18–27 |
| **B1** | 38–50 | 10–17 |
| **below B1** | 0–37 | 0–9 |

(The app's current Reading/Listening thresholds — 28/18/10 of /35 — are the same bands on the
raw-correct proxy scale. Writing uses the /75 scale directly.)

### 4.5 Worked examples (sanity) — all three tasks at the same band
(weights 4 + 8 + 24 = 36, so an even band `b` gives `raw = 4b`)
- All tasks band 9 → 4+8+24 = 36 → **75 (C1)**.
- All tasks band 7 → 3.11 + 6.22 + 18.67 = 28.0 → **64 (B2)**.
- All tasks band 5 → 2.22 + 4.44 + 13.33 = 20.0 → **49 (B1)**.
- Mixed (1.1=6, 1.2=7, 2=5) → 2.67 + 6.22 + 13.33 = 22.2 → **54 (B2)**.

---

## 5. Current state (already built, UI-first)

Frontend on local fixtures + localStorage (no backend):
- **Catalog** (`WritingPage`): 5-tab `TabStrip`, a **custom `Dropdown`** status filter (All / Not
  started / Completed), 3-col card grid, dashed **Add Custom Task** tile per task tab.
- **`WritingTaskCard`**: icon tile, task chip, Recommended badge, No-attempts/Completed, Start/Retake/Resume.
- **Custom Question tab** + **Add-custom modal** (task-type dropdown, question, optional image, title).
- **Writing screen** (`WritingTaskPage`): full-screen portal, split pane, reused `Timer`, live word
  count, **autosave + resume**, Exit-cancel + under-word confirm dialogs, calm **Submitted** placeholder.
- **Data layer:** `writingFixtures / writingCatalog / writingCustom / writingAttempts / writingDraft`
  (localStorage); `Skill` union, `skillMeta`, sidebar/route wired; `WritingTest`/`WritingTask` types.
- **Reusable:** `Dropdown.tsx`, `Toast.tsx`.

The remaining work replaces fixtures/localStorage with Supabase and adds grading + the report + gating.

---

## 6. Data model

### 6.1 Types (`src/types/test.ts`)
`WritingTask` gains per-task `durationSec` + a `weight` (12/24, from §3) + server-only rubric:
```ts
WritingTask = {
  id, taskType, label, minWords, maxWords?, durationSec,
  weight,                              // 4 / 8 / 24 (Cefrly 3-task weights, sum 36) — see §3
  zeroMarkMinWords,                    // 20 (Task 1) / 40 (Task 2)
  prompt: { title?, html }, image?,
  rubric?, modelAnswer?                // SERVER-ONLY; feeds the grader, stripped by get-test
}
```

### 6.2 Grade result
```ts
WritingTaskGrade = {
  taskId, band: 0..9,                  // holistic band for the task
  criteria: {                          // 0..9 each (official four)
    task_achievement, grammar, vocabulary, coherence
  },
  points: number,                      // (band/9)×weight
  wordCount, underlengthCapped: boolean, zeroMark?: 'off_topic'|'too_short'|'plagiarism'|'blank',
  corrections: { start, end, type, suggestion, note? }[]   // inline marks over this task's text
}
WritingGrade = {
  tasks: WritingTaskGrade[],
  raw36: number,                       // Σ points
  overall75: number,                   // lookup(raw36)
  band: 'below_B1'|'B1'|'B2'|'C1',     // from overall75
  summary: string,                     // short English feedback
  model: string, gradedAt: string,
}
```

### 6.3 Database (Supabase)
- `tests.skill` check → add `'writing'`. `test_content` holds tasks + server-only rubric/modelAnswer.
- `attempts`: store per-task answers in `answers`, `WritingGrade` in `result`, `raw_score = overall75`,
  `total = 75`, `band` = mapped band (nullable until graded), add `grading_status`
  ('pending'|'graded'|'failed').
- `writing_custom_questions` (new): `id, user_id, task_type, title, question, image_path, created_at`;
  RLS own-rows only.
- `subscriptions`/`essay_quota` (new, when monetization is on): plan + remaining essays; decrement per grade.
- **Security invariant:** browser never reads `tests`/`test_content`; `get-test` strips
  rubric/modelAnswer; grading is server-side; browser only receives the finished `WritingGrade`.

---

## 7. AI grading pipeline

1. Submit → `submit-writing` stores answers, `grading_status='pending'`, checks essay quota.
2. `grade-writing` (provider-agnostic) builds the grader input: the answers + each task's
   rubric/modelAnswer + **the official band descriptors (PDF 1) + the zero-mark & underlength rules**.
   Instruct the model to return **structured JSON** = `WritingGrade` with a 0–9 per criterion + a
   holistic task band + inline corrections, applying zero-mark/underlength.
3. **System computes the maths, not the model:** `points = (band/9)×weight`, `raw36 = Σ`, `overall75 =
   lookup(raw36)`, band from §4.4. (The model judges quality; the code does the arithmetic so scores
   are exact and auditable.)
4. Validate: bands in 0–9, corrections' offsets within the text, JSON shape. Retry once on bad output;
   mark `failed` + graceful retry UI on repeated failure.
5. Store, set `band`/`raw_score`/`total`, decrement quota.
6. Frontend polls/subscribes → report.

Provider-agnostic: one function, one input→`WritingGrade` contract; the owner's model drops in via config.

---

## 8. Screens still to build

- **Analysing state** — brief "Analysing your writing…" after submit while grading runs (async).
- **Report / analysis page** (`/writing/result/:attemptId`): headline **/75 + CEFR band**; per-task
  **band /9** + the **four criteria /9**; the student's text with an **Original ↔ Feedback** toggle
  showing **inline corrections**; a short English summary. Free tier sees score/band; detailed
  criteria + inline corrections gated by subscription/quota (upsell panel). Cefrly design system, cat
  mascot, no dark panels.
- **My Results**: writing attempts as their own cards (Writing chip, /75 + band), off the CEFR ruler.
- **Catalog**: DB-driven cards, real Completed state, an "essays left" indicator when quotas are live,
  filter-aware empty-state copy.
- **Writing screen change**: **per-task timers** for the mock (each task its own countdown; on expiry
  auto-save + advance, no return to a timed-out task). Drop the unused Upload button.

---

## 9. Backend (edge functions)
- `get-test` — writing branch in `sanitize()`: keep prompts/labels/images/word targets/durations/weights;
  strip `rubric` + `modelAnswer`.
- `submit-writing` — store answers, create attempt (`pending`), quota check, invoke grader.
- `grade-writing` — the provider-agnostic AI grader (§7).
- `writing-custom` — CRUD for a user's custom questions (RLS).
- `admin-writing` — list/get/upsert/setStatus/archive + a **bulk import** (array of validated writing
  tests) so the owner can "upload all the tests via Claude"; schema validator mirrors the client.
- Sessions reuse `start-session`/`session-status`/`session-control` (clock-based; mock carries per-task timing).

---

## 10. Authoring
- **Admin form** `/admin/tests/new/writing` (+ edit): scope, each task's prompt (rich text), word
  targets, per-task duration + weight, optional image, and the **server-only rubric + model answer**.
  Reuse `admin-writing` + a client validator; publish/unpublish/archive.
- **Bulk import**: a documented `writing-tests.json` schema + a seed/import script (like
  `build-samples-seed.mjs`) OR the `admin-writing` bulk endpoint — validated, idempotent by slug, so
  re-uploading is safe. This is the "upload all the tests easily via Claude" flow.

---

## 11. Monetization (subscription + essay quota)
- Each plan includes a **quota of AI-graded essays** (Free = N, Pro = M, Premium = more/unlimited —
  numbers TBD). Free/unlimited for now (quota check is a no-op).
- When on: `grade-writing` decrements per essay; out-of-quota → answer stored, ungraded, report shows an
  **upgrade** panel (ties into the existing 3-tier Pricing). Optionally: score/band free, detailed
  feedback gated.

---

## 12. Build order
1. Backend foundation — migration (`skill='writing'`, `writing_custom_questions`), `get-test` writing
   branch, `writing-custom`, move custom questions off localStorage. *(deploy-gated)*
2. Confirm §3 structure → finalise the task→weight model.
3. Content + authoring — schema/validator, `admin-writing`, admin form, bulk import; load owner's papers.
4. Grading — `submit-writing` + `grade-writing`, the `WritingGrade` schema + the official maths (§4),
   wire the owner's model.
5. Report screen — /75 + band + 4 criteria + Original↔Feedback inline corrections; analysing state; gating shell.
6. My Results — writing attempts (off the CEFR ruler).
7. Per-task mock timers.
8. Monetization — plans + quotas + enforcement + upgrade panels.
9. Polish — filter-aware empty states, essays-left indicator, "grading done" notifications.

---

## 13. Out of scope
- Handwriting/photo upload + OCR (typed only). · Uzbek-language feedback (English only). · Speaking. ·
  A combined 4-skill /75 overall CEFR result (later cross-skill feature; writing shows its own /75 now).

---

## Appendix — source documents (in repo, gitignored-safe to keep local)
- `Writing criteria multilevel.pdf` — full 0–9 band descriptors × 4 criteria, per task; zero-mark +
  underlength rules. **The grader's rubric.**
- `Chet tili (multilevel) baholash mezonlari - yangi.pdf` — Rasch/standardisation for L&R, the
  writing weights (12/24), the raw/36→final/75 conversion table, and the /75→CEFR thresholds.
