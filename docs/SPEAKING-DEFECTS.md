# Speaking — defect log

Every bug that has reached a student in the Speaking section, from the day it
shipped. One row per defect, oldest first.

**Rule: nothing is fixed until it is in this file with a test next to it.**
Add the row when you find the bug, not when you ship the fix. Fill in the
`Guarded by` column with a real test path — `none` is an admission, and every
`none` in this file is a bug that can come back tomorrow.

Sources: git history of `supabase/functions/grade-speaking`, the
`speaking_attempts` table, and `CLAUDE.md`. Dates are commit dates.

---

## Why the same kinds of bug keep coming back

The owner's complaint on 2026-09-04 — *"every time different or same mistakes
are occurring but you are not fixing them"* — is correct, and this is why. Four
concrete reasons, all fixable:

**1. There is not one test file for the grader. There never has been.**

```
git log --all --diff-filter=A --name-only | grep -c "grade-speaking.*test"  →  0
```

The 2026-08-31 commit `4d91959` says *"28 cases covering every block and every
descriptor pass"*. Those 28 cases were written in a scratchpad, run once, and
deleted. Nothing stops the 29th change from breaking all of them, and on
2026-09-03 something did — twice.

**2. Every fix is proved against one student's paper, and then that paper is
destroyed.** A successful grade deletes the recordings within seconds
(`deleteClips`). So the case a fix was built on can never be re-run. Each fix is
a one-shot experiment.

**3. There is no calibration set, so "is the mark right?" is unanswerable.**
Only "is it obviously broken?" is. The owner has real papers with official human
marks (`Speaking band score/`, gitignored). Until 20-30 of them are graded and
compared, every tuning decision in this file is guesswork — including the good
ones.

**4. Detection is a student complaining.** Every scoring defect below was found
because someone said their mark was unfair. Nothing watches for the impossible
results the database can see for itself: a block scoring 0 with 200 words of
speech on it, or a student's own two attempts landing more than one band apart.

### What actually closes this

| | Action | State |
|---|---|---|
| A | `supabase/functions/grade-speaking/scoring.test.ts` — the pure functions (`overallLevel`, `allAtLeast`, `scoreBlock`, `ratingForRaw`, `estimateRatingFromProfile`, quote verification) with a case per defect below | **done 2026-09-04** — 29 cases, `node --test supabase/functions/grade-speaking/scoring.test.ts`. It caught a bug in its own day's fix (the ellipsis branch could never fire, because normalising had already eaten the `…`). |
| B | The zero rule extracted to `verify.ts` as ONE testable function, so it can be tested without audio, a model or a network | **done 2026-09-04** |
| C | A scheduled sanity query: flag any block scoring 0 with a substantial transcript, and any student whose own attempts differ by more than one band | **done 2026-09-04** — migration 0025, nightly at 02:15 UTC (see *The alert queue* below) |
| D | Calibration: grade 20-30 of the owner's officially-marked papers, compare, record the gap | **not started** — this is now the only thing standing between "not obviously broken" and "measurably right" |

**Run the tests before every grader change.** They are the reason #27 cannot come
back, and they are cheap: no audio, no model, no network, 0.2 seconds.

---

## The log

Class: **SCORE** = a wrong mark reached a student · **LOST** = the paper or the
answers were lost · **DEAD** = the check failed to finish · **COUNT** = wrong
denominator or question count · **COST** = money, limits, duplicate work ·
**UI** = the page itself was unusable.

| # | Date | Class | What the student saw | Root cause | Fix | Found by | Guarded by |
|---|---|---|---|---|---|---|---|
| 01 | 08-31 | LOST | The question was never read aloud on some machines | Chrome refuses `speechSynthesis` before a user gesture, and drops an utterance when `cancel()` is followed immediately by `speak()` | Mic-check click primes speech; `cancel()` only when speaking; gap + one retry; `onstart` proves sound really began; refused questions hold on a button instead of starting the clock | Students | none |
| 02 | 08-31 | LOST | The recording contained the question itself | Preparation kept counting while "Hear it again" played, so on Part 1.1's 5s prep the recorder opened mid-sentence | Preparation freezes while the question is read | Testing | none |
| 03 | 08-31 | LOST | "Resume" restored the question number with the answers silently gone; those questions scored 0 on a paid check | Recordings lived in memory only | Interrupted attempts discarded with an explanation; `beforeunload` warning | Students | none |
| 04 | 08-31 | COUNT | Skipping questions was rewarded | Unanswered questions were dropped before upload, so the grader saw a 2-question block where the paper had 3 | Declared as `NO ANSWER RECORDED`; the rubric counts them against the block | Audit | none |
| 05 | 08-31 | COUNT | "Raw score 12 of 15" for what was really 12 of 21 | The page summed the blocks that came back instead of the paper's total | Server's `maxRaw` stored and used | Audit | none |
| 06 | 08-31 | COST | A Pro student at their limit was told only after speaking for 15 minutes | The catalog only checked for "no paid plan" | Reads the remaining allowance, warns on the first click | Audit | none |
| 07 | 08-31 | DEAD | Spinner until the platform killed it | The grade was held open inside the student's own request | 202 + `EdgeRuntime.waitUntil`; the analyze page polls | Audit | none |
| 08 | 08-31 | COST | One exam paid for twice; the faster run deleted the clips the other was still reading | Only `status='done'` short-circuited, so auto-send + a reload both reached Gemini | `grading_started_at` + `grading_runs` (migration 0024); a run younger than 5 min returns 202 | Audit | none |
| 09 | 08-31 | COST | Unlimited free retries | A failed grade costs no allowance, and nothing else capped it | 5 runs per attempt, 10 attempts per hour, staff exempt | Audit | none |
| 10 | 08-31 | DEAD | "The check did not finish" on a parse error, charged again on retry | No `maxOutputTokens` → truncated JSON; no timeout → hung call rode to the wall clock | 8192 tokens, 150s abort, one retry on 429/5xx, explicit `finishReason !== 'STOP'` message | Audit | none |
| 11 | 08-31 | LOST | A stray Ctrl+R cost every answer given | Clips lived in the page until Submit | Each answer uploads the moment it is recorded; the draft remembers where it landed; resume for 45 min | Students | none |
| 12 | 08-31 | **SCORE** | A Part 1.1 drill — three easy questions anchored at A2 — reported **75/75, C1** | `estimateRatingFromBlock` scaled one block straight to /75 | `BLOCK_RATING_CAP` clamp (later replaced, see 15) | Audit | none |
| 13 | 08-31 | **SCORE** | Top marks awarded on blocks the model had just listed errors in | The model was asked to award the 0-5 mark itself | The model reports observations only (5 CEFR criteria + on-topic count + coverage + balance); `scoreBlock()` computes the mark | Audit | **deleted** (28 scratchpad cases) |
| 14 | 09-01 | **SCORE** | The same speaker got different bands on the same day — 49 and 40, 23 minutes apart. Across all repeat sitters: **18 rating points apart on average, 28 at worst** | The five criteria were judged *inside each block*, so the model rated the difficulty of the task, not the speaker | ONE profile per attempt, judged once, reused by every block | A student's complaint | none |
| 15 | 09-01 | **SCORE** | A student judged B2 on all five criteria, 5/5 on the block, was shown **49/75, B1** | Defect 12's cap was read as a ceiling on the speaker when it is a floor on what the task can prove | `estimateRatingFromProfile` — the drill estimate comes from the profile, reduced for what was not answered | A student's complaint | none |
| 16 | 09-01 | **SCORE** | Papers marked by the retired model the rebuild had just replaced — fixed 3-errors-1-strength on every answer, flat all-B1 on B2 speech | A stale `GEMINI_MODEL` secret beat the new default | The override is honoured for anything except the retired lite tier | Result signature spotted by eye | none |
| 17 | 09-01 | DEAD | "Gemini 404: models/gemini-3.1-flash is not found" on every check | Google removed the model from `generateContent` | Default to `gemini-3.7-flash`; dead names blocklisted | Total outage | none |
| 18 | 09-01 | DEAD | Google's raw `UNAVAILABLE` JSON, and "record again" | 503 "high demand" bursts outlasted a single 1.5s retry | 3 tries per model (2s, 6s), then previous flash generations; a plain "the AI examiner is busy" message | Students | none |
| 19 | 09-02 | DEAD | "Checking…" forever, paper unrecoverable, no error row | One model call over all eight recordings outran the platform's 150s kill; the process died before the `catch` that writes `failed` | One call per block, run in parallel, plus a text-only profile pass | A student's lost paper | none |
| 20 | 09-02 | DEAD | A finished, fully scored paper thrown away | Each model call carried its own fresh time budget, so the profile call launched with a full budget on a 50s runway | One deadline anchors the whole run | Slowdown incident | none |
| 21 | 09-02 | DEAD | The whole grade lost when the profile pass had no time | The profile pass was treated as required | Too little time → arithmetic middle of the block judgements | Slowdown incident | none |
| 22 | 09-02 | DEAD | A Gemini outage lost the paper | No fallback beyond Google's own ladder | Automatic OpenRouter retry of the same request | Slowdown incident | none |
| 23 | 09-02 | DEAD | ~40s added to every check during a Google degradation | The hung primary lane was always tried first | `OPENROUTER_FIRST` flips the ladder during an incident (unset when Google recovers) | Incident | none |
| 24 | 09-03 | **SCORE** | A C1 paper came out **35/75, Below B1**, while the grader's own reasons said every part was fully answered | The `onTopic` quote was checked against the transcript of the model's `questionIndex` — but since the parallel split each call numbers its questions from 0, a real quote was searched inside the wrong answer | Verification normalises case/punctuation and searches all of that block's transcripts; quotes deduped; every failure logged | A student's complaint (gulmirasobirova) | none |
| 25 | 09-03 | **SCORE** | The same paper then read **75/75, C1**. A2 grammar and A2 vocabulary behind a C1 surface scored a flawless paper | `overallLevel` was the plain median of five criteria, discarding the two weakest outright — the paper had only four possible outcomes (75/64/49/32) | `min(median, weakest + 1)`; plus `judgeSpeaker` runs twice (temp 0 and 0.4) and takes the per-criterion lower | Re-check after 24 | none |
| 26 | 09-03 | **SCORE** | Q7's 5 ("above B2") and Q8's 6 ("above C1") were automatic — and Q8's 6 is the only mark that can carry a paper to 21/21 | Those top marks were awarded on the median alone | They now require `allAtLeast(criteria, C1)` — every criterion, not the median | Re-check after 24 | none |
| 27 | 09-03 | **SCORE** | **46/75, B1** on a paper where all 8 questions were answered. Part 3 = **0/6** on a 240-word, two-sided argument the model itself called *"a balanced discussion covering both benefits and drawbacks"*. Part 1.2 = 3/5 instead of 5/5. Correct mark: **64/75, B2** — her two previous mocks both scored exactly that | The quote fix from 24 still demanded an **exact contiguous substring**. A quote stitched across a gap, or tidied by one word while being copied, failed — and a failed quote meant "never answered", so a one-question block went to 0. The quote never tested topicality at all; it only tested that words existed, in a transcript we already hold | Verification widened (exact → ellipsis runs → 5-gram containment ≥ 0.6); a failed quote no longer erases an answer that has real speech behind it: `onTopicCount = min(questionCount, spoken, max(verified, claimed))`; `quoteAudit` + `spokenAnswers` stored in `result.blocks` so a disputed mark can be re-examined after the audio is gone | A student's complaint (gulmirasobirova, attempt `6c207362`) | `scoring.test.ts` (5 cases) |
| 28 | 09-04 | *(Found by asking "will this happen again?" rather than by a student.)* Same symptom, next door: if the model simply **left a question off** its on-topic list, the block still scored 0 — with 240 words of on-topic speech on the recording | #24 and #27 each closed the one door the bug came through. Zeroing was still something the model could cause by **staying silent** | The rule replaces the door. `verify.ts`: a mark may only be zeroed by CONTRADICTED evidence — silence on the recording, or an affirmative `offTopic: true` from the model, now a **required** schema field. Missing quotes, missing list entries and missing fields lower confidence and can never erase a spoken answer | Asking whether the class was closed | `scoring.test.ts` (7 cases) |
| 29 | 09-05 | UI | On a phone the task cards ran off the right edge of the screen — the question text disappeared past the edge and the page scrolled sideways | The card grids declared columns only from `sm:` up (`grid gap-6 sm:grid-cols-2`). With no base column, CSS gives the implicit track `min-width: auto`, so it sized to the LONGEST question instead of the screen; that also defeated the title's `truncate`, since truncation needs a bounded parent | `grid-cols-1` added to all 31 affected grids (`repeat(1, minmax(0,1fr))` — a track that may shrink). Card titles changed from `truncate` to `line-clamp-2`: a task card's title IS the exam question, and ending it in an ellipsis hides what the student is about to answer | The owner, on his phone | Measured in a real browser at 390px: 120px overflow before, 0px after |

---

## What the shape of this log says

**Eight of the 27 are SCORE defects, and all eight are in the last five days**
(12, 13, 14, 15, 24, 25, 26, 27). Every one of them was found by a student
saying their mark was unfair. None was found by us.

**Three of them are fixes of fixes.** 15 undid 12's overcorrection. 27 is the
half of 24 that 24 did not reach. 25 and 26 were exposed only because 24 stopped
the zeroing that had been hiding them. This is exactly what a codebase with no
tests does: each repair moves the failure somewhere else and nothing notices.

**The zeroing bugs share one design mistake.** A single unverifiable piece of
evidence was allowed to mean "this never happened", on blocks worth up to 6 of
the paper's 21 marks. Evidence that is *missing* should lower confidence. Only
evidence that is *contradicted* — silence on the recording, a question the model
left out of `onTopic` — should be allowed to zero a mark. Check any new rule
against this before shipping it.

---

## Still open

| | Item | Why it matters |
|---|---|---|
| O1 | **No calibration set.** Nothing about the grader is measurable. | Every number in this file is "less obviously broken than before", not "correct". 20-30 of the owner's officially-marked papers would settle it. |
| O2 | **A successful grade deletes the audio within seconds** (`deleteClips`); only failed/abandoned clips survive 3h (`ORPHAN_MS`). | A disputed mark can never be re-heard. Defect 27 could only be diagnosed because the transcripts happened to be stored. |
| ~~O3~~ | ~~Attempt `6c207362` shows 46/75 B1~~ | **Closed 2026-09-04.** grade-speaking **v29** deployed; the attempt recomputed to raw 18/21 → **64/75 → B2** under the new rules from its own stored transcripts and profile. `result.correction` on that row records the previous mark, the defect and the fact that this was a recompute, not a re-grade (the audio was already gone). |
| O4 | **Defect 16's failure mode has no guard.** A wrong model can mark real papers and only a human noticing the output's *style* catches it. | Store the model name that produced each grade and alert on a change. (`result.model` is stored — nothing reads it.) |

---

## The alert queue

Migration 0025 added `speaking_grade_anomalies` (a view) and
`speaking_grade_alerts` (rows a human reads), swept nightly at **02:15 UTC** by
`sweep_speaking_grade_anomalies()` via pg_cron. Service-role only — students
never see it. It never changes a mark.

| kind | fires when | the defect it would have caught |
|---|---|---|
| `zero_with_speech` | a block scored 0 while its own questions carry ≥10 words each | #24, #27, #28 |
| `band_swing` | a student's consecutive full mocks differ by more than 15 rating points | #14 |
| `no_profile` | a graded attempt has no language profile (every block scores 0 by design) | #13 |
| `stuck_grading` | `status='grading'` for more than 15 minutes | #19, #20 |

Read it with:

```sql
select a.kind, a.detail, a.detected_at, s.user_id
from speaking_grade_alerts a join speaking_attempts s on s.id = a.attempt_id
where a.resolved_at is null order by a.detected_at desc;
```

Close a row with `update speaking_grade_alerts set resolved_at = now(), note = '…'`.

**First run, 2026-09-04:** 17 alerts, all historical — 12 `no_profile` from
August (graded by `gemini-3.1-flash-lite` before profiles existed), 3
`band_swing` from the exact #14 window (19 → 54 → 64 for one student), and 2
`zero_with_speech` on 2026-09-01 that a manual pass had waved through as
"the student only answered two questions". All closed as historical; the audio
is gone and they cannot be re-graded. **The queue is now empty, so any row that
appears from here is a live problem.**

---

## Owner's standing calls (do not undo)

- **No automatic penalty for error density** — *"high level students also make
  silly mistakes"*. Basic-agreement errors count as A2 evidence only when
  systematic. (2026-09-03)
- **No human review queue for high scores.** Rejected. (2026-09-03)
- **C2 is aspirational only.** The exam grades to C1; 75 is the ceiling.
