# Cefrly — Project Context

## What this is
A standalone CEFR (English proficiency) mock-exam + prep platform for Uzbek learners.
Own domain (cefrly). Separate from MilliyMock, but MilliyMock users can hand off into
Cefrly without re-registering (see Auth). Phase 1 builds the foundation + the READING section only.

## Stack (do not change without asking)
- Frontend: Vite + React + TypeScript + Tailwind CSS + React Router
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions)
- Server state: TanStack Query. In-test state: useState/Zustand.
- Hosting: Vercel (frontend), Supabase (database + edge functions)

## Non-negotiable security rules
- The browser must NEVER receive answer keys or explanations before a test is submitted.
- To show a test: call an Edge Function that returns a SANITIZED test (every `answer` and
  `explanation` field stripped; keep options, optionPool, prompts, passages, thirdOptionLabel).
- To score a test: call an Edge Function that reads the real test server-side and returns results
  + explanations.
- The service_role key lives ONLY in Edge Function secrets. Never in frontend code.
- Frontend uses only VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

## READING paper structure (rigid — 35 questions, 5 parts)
- Part 1 (Q1-6): word-from-passage cloze, 6 gaps -> item type `gap`
- Part 2 (Q7-14): match 8 short texts to statements A-J (10 options, 2 unused) -> `match`
- Part 3 (Q15-20): match 6 paragraphs (I-VI) to 8-9 headings -> `match`
- Part 4 (Q21-29): one long text, MCQ (A-D) + True/False/Not-Given. ORDER & SPLIT VARY.
  -> `mcq` + `tfng`
- Part 5 (Q30-35): one academic text, summary completion (30-33) + MCQ (34-35) -> `gap` + `mcq`
Only 4 item types and 5 fixed part layouts cover every reading test.

## Item schema (v2) — canonical TypeScript lives in src/types/test.ts
type ReadingTest = { id, skill:'reading', targetLevels:['B1','B2','C1'], durationSec:3600, parts:Part[] } // 5 parts
type Part = {
  id, number:1|2|3|4|5,
  layout: 'cloze_from_text' | 'match_texts' | 'match_headings' | 'passage_questions',
  instructions,
  passage?: { title?, html?, paragraphs?: {label, html}[] },  // html holds {{itemId}} gap markers
  optionPool?: {key,label}[],                                 // parts 2 & 3 shared options
  items: Item[]                                               // ordered; render in this exact order
}
type Item =
 | { id, type:'gap',  points:1, answer:string[], caseSensitive?:false, explanation }
 | { id, type:'match',points:1, prompt, answer:string, explanation }              // answer = optionPool key
 | { id, type:'mcq',  points:1, prompt, options:{key,label}[], answer:string, explanation }
 | { id, type:'tfng', points:1, prompt, thirdOptionLabel:'Not Given'|'No Information',
     answer:'true'|'false'|'not_given', explanation }
type explanation = { location, quote, reasoning }  // shown only after submit

## Rendering rules per layout
- cloze_from_text (Part 1): render passage.html, replace each {{itemId}} with a small inline text input.
- match_texts (Part 2): show each item.prompt (short text) as a card with a dropdown of optionPool (A-J).
- match_headings (Part 3): show passage.paragraphs (I-VI); each paragraph gets a heading dropdown from
  optionPool. Don't block reusing a letter; just mark wrong on results.
- passage_questions (Parts 4 & 5): split-pane. Passage left, questions right in list order. Each item
  renders per its own type (mcq radio, tfng three-button, gap input).

## Scoring (Reading-only = indicative band from raw correct count out of 35)
- 28-35 -> C1 | 18-27 -> B2 | 10-17 -> B1 | 0-9 -> below_B1
- Grading: gap = normalized text in answer[] (trim+lowercase); match/mcq = key equals answer;
  tfng = selection equals answer. Each correct item = 1 mark.
- Label the result as an INDICATIVE reading band. The true /75 4-skill average comes in a later phase.

## LISTENING paper structure (Phase 3 — rigid: 35 questions, 6 parts, each recording played TWICE, ~35 min)
Fixed per-part counts/layouts (DO NOT change): 8/6/4/5/6/6 = 35.
- Part 1 (Q1-8): layout `mcq_response` — hear a short prompt, choose the best REPLY. 8 `mcq`, 3 options (A/B/C), NO written prompt.
- Part 2 (Q9-14): layout `form_completion` — a titled form/notes with 6 blanks; type ONE word/number each. 6 `gap` in `stem.html`.
- Part 3 (Q15-18): layout `matching` — match 4 speakers to an option pool (letters, with EXTRAS). 4 `match` + `optionPool`.
- Part 4 (Q19-23): layout `map_labelling` — label 5 places on a MAP/PLAN IMAGE using letters (with EXTRAS). 5 `match` + `image` + `optionPool`. REQUIRES an image.
- Part 5 (Q24-29): layout `multi_extract_mcq` — THREE extracts; each has a `context` line + 2 MCQs (3 options). 3 `groups` × 2 `mcq` = 6.
- Part 6 (Q30-35): layout `note_completion` — notes/sentences with 6 blanks; type ONE word each. 6 `gap` in `stem.html`.
Only THREE item types in Listening: `mcq`, `match`, `gap` (NO `tfng` — that is Reading). Gap answers accept MULTIPLE spellings
(real keys: "1.30 / one hour and thirty minutes", "(desert) plants", "twelve/12", "sunrise(s)").

## Listening schema v2 — canonical TypeScript lives in src/types/test.ts (shares mcq/match/gap with Reading)
```
ListeningTest = { id, skill:'listening', targetLevels:['B1','B2','C1'], durationSec:2400,
  audioMode:'per_part'|'single', singleAudio?:{assetPath,playLimit:2,previewSec} /* iff single */, parts:Part[6] }
Part = { id, number:1..6, layout:<one of the six>, instructions,
  audio?:{assetPath,playLimit:2,previewSec} /* iff per_part */, image?:{assetPath,alt} /* map_labelling */,
  optionPool?:{key,label}[] /* matching & map_labelling */, stem?:{title?,html} /* form/note; html holds {{itemId}} */,
  groups?:Group[] /* multi_extract_mcq */, items?:Item[] /* all non-group layouts */, transcript? /* SERVER-ONLY */ }
Group = { id, context, items:Item[] }
Item = mcq (prompt OPTIONAL — Part 1 has none) | match (prompt = "Speaker 1" / place name) | gap (answer:string[] spellings)
```
- Audio lives in the `audio` storage bucket, map images in `images` (public read, admin-only write; helpers in src/lib/storage.ts).
- Rendering (skill='listening'): render the part's audio (per_part player, or the single top-of-section player) THEN the layout:
  mcq_response=8 A/B/C radios (no prompt) · form_completion/note_completion=`stem.html` with {{itemId}}→text inputs ·
  matching=speaker rows with an optionPool dropdown · map_labelling=`image` + place rows with a letter dropdown ·
  multi_extract_mcq=each group = context line + its 2 MCQs. Reuse the SAME timer/mark-for-review/navigator(1-35)/autosave.
- Grading (skill-agnostic in submit-test, flatten groups): mcq/match = key equals answer; gap = normalized (trim+lower) typed
  matches ANY string in answer[]. 1 mark each, /35 → indicative LISTENING band (thresholds 28/18/10, same as Reading).
- Security (unchanged): get-test strips every answer, explanation AND transcript for listening (keeps audio/image/optionPool/
  stem.html/groups[].context/prompts/options); grading is server-side in submit-test; browser never reads the `tests` table.
- audioMode='per_part' → each part needs `audio`; 'single' → the test needs `singleAudio` and no per-part audio. map_labelling
  needs `image`. Server validation in admin-tests mirrors these + counts 8/6/4/5/6/6; upsert writes nothing on failure.

## Conventions
- TypeScript strict. Clear folders (src/pages, src/components, src/lib, src/types). Small components.
- Keep it simple. Phase 1 = Reading, Phase 3 = Listening (both live). Do NOT build Writing/Speaking yet.

## Working notes (added during phase 1)
- Test authoring: edit supabase/seed/reading-test-1.json, then `npm run seed:generate`
  (validates the rigid structure and writes supabase/seed/seed.sql).
- Answer keys live in the test_content table (RLS, no policies = service_role only).
  Edge functions: supabase/functions/get-test (sanitizes) and submit-test (grades).
- Timing is server-side: get-test creates/reuses a test_sessions row (started_at,
  expires_at); refreshing resumes the same countdown. submit-test rejects attempts
  past expires_at (+2 min grace) with 409 and closes the session.
- In-test answers are drafted to localStorage (`cefrly-draft-<sessionId>`) so a
  refresh never loses progress; the draft is cleared on submit.
  DRAFT-WIPE BUG FIXED 2026-07-06: TestPage's restore effect had a cleanup
  reset() that ran BEFORE the saver subscription unsubscribed (React runs
  same-component effect cleanups in declaration order; zustand notifies
  synchronously), so ANY in-app exit (Exit button, route change) overwrote the
  draft with {} — exit+resume came back blank while the dialog promised
  "answers are saved". Refresh was unaffected (no cleanups on unload), which
  is why testing missed it. The fix: the SAVER effect owns the unmount reset
  and unsubscribes FIRST; the restore effect has no cleanup. Never reintroduce
  a store-reset that can fire while the draft-saver is subscribed. All
  localStorage draft ops are try/catch-guarded (blocked/full storage must not
  crash the exam). Verified live: type → Exit dialog → resume → answer intact.
  KNOWN LIMITS (by design for now): drafts are client-side only — resuming on
  another device restores the session/timer but not typed answers; listening
  simulation playLimit is client-side only (exit/refresh restores plays; audio
  URLs are public) — real enforcement needs signed URLs + server play counts.
- Local env goes in .env.local (gitignored). Never commit keys.
- PHASE 2 (admin dashboard) is built: profiles.role (student/admin/super_admin;
  role changes only via admin-users edge function — column grant blocks direct
  updates), tests has slug + status (draft/published/archived), /admin area with
  role guards, admin-tests edge function (list/get/upsert with full schema-v2
  validation/setStatus/archive), fixed-template Reading form at /admin/tests/new
  and /admin/tests/:slug, /admin/admins for the super admin. Owner accounts
  (azimrkhmv@gmail.com, ysharpist@gmail.com) are super_admin.
- DEV ONLY: an `auto_confirm_on_signup` trigger on auth.users confirms new accounts
  instantly (Supabase email confirmation is effectively bypassed). REMOVE before
  launch and set up real SMTP + confirmations.
- MilliyMock hand-off IS implemented: milliymock-handoff edge function (verify_jwt
  off, verifies its own HS256 JWT against MILLIYMOCK_HANDOFF_SECRET, single-use jti
  via handoff_tokens table, 60s lifetime) + /handoff frontend route that exchanges
  the returned tokenHash via auth.verifyOtp. Requires the MILLIYMOCK_HANDOFF_SECRET
  edge function secret to be set (same value on the MilliyMock side).
- TEST MODES (Practice vs Simulation) are live for BOTH skills. Every attempt
  starts at the full-screen "Choose a mode" picker (ModePicker; TestPage calls
  session-status first — a read-only peek that never starts a clock). An open
  attempt shows a Resume banner; picking a mode instead REALLY restarts:
  start-session closes any open session for that test before creating the new
  one. Sessions carry mode/duration_sec/paused_at (migration 0008).
  · READING is clock-based: Simulation = fixed test duration, no pause;
    Practice = student-chosen 20–90 min in 10-min steps (validated server-side)
    with a pausable timer (session-control pause/resume shifts expires_at).
  · LISTENING is audio-based: NO time-limit choice and NO countdown/pause UI in
    EITHER mode — the recordings set the pace. Simulation keeps the locked
    AudioPlayer (previewSec gate, playLimit 2, no pause/seek); Practice swaps in
    PracticeAudioPlayer (play/pause, ±10s, scrub, unlimited) via ListeningAudio
    (dispatches on session.mode). Server-side, listening sessions get a hidden
    6h housekeeping expiry (start-session + get-test fallback) so no invisible
    clock can 409 a submit; never surface it in the UI.
  Reading spine (player/timer/mark-for-review/navigator 1–35/autosave/results).
  Storage: `audio` + `images` buckets (public read, admin-only write via
  public.is_admin) with src/lib/storage.ts helpers; migration 0007. Fixture
  `listening-mock-1` (placeholder .wav clips) is ARCHIVED; the live catalog has TWO
  REAL tests, `listening-mock-2` + `listening-mock-3` (ingested 2026-07-06 from the
  owner's Multilevelzonemock Day 157/156 papers; content lives ONLY in the DB —
  source papers/audio stay in the gitignored `listening sample/` folder, never in
  git). Both are audioMode 'single': ONE SOLID recording `<slug>/full.mp3`
  (playLimit 1, previewSec 0) built with ffmpeg (imageio-ffmpeg) as Part 1 TWICE
  (its repeat wasn't baked in; parts were mixed 48k/44.1k so re-encode, 44.1k
  128k CBR) + Parts 2–6 (their "played twice" repeats ARE baked in — durations ≈
  the paper's 35-min total). The unused per-part MP3s + map PNGs also sit in
  storage under <slug>/.
  Explanation cards cite the official answer keys (no transcripts available). Player: src/components/test/
  AudioPlayer.tsx (previewSec gate + playLimit cap, no seek/pause, state in
  src/store/audio.ts so counts survive part nav). LISTENING AUTOPLAY: recordings
  auto-start, no click needed — simulation fires the FIRST play the moment the
  recording unlocks (once-per-mount effect in AudioPlayer; falls back to the manual
  button if the browser blocks autoplay, e.g. right after a refresh); practice
  auto-starts only on the FIRST open of each part (flagged via useAudioStore plays).
  In single mode the player is wrapped sticky (top of the scroll area, above the
  part tabs, in TestPage) so it never unmounts on part navigation — the recording
  rolls straight through all six parts. VOLUME: shared slider (VolumeControl.tsx)
  on both players; the 0..1 value lives in useAudioStore + localStorage
  ('cefrly-volume') so it persists across parts/attempts; store reset() keeps it
  (missing key MUST default to 1 — Number(null) is 0, i.e. muted). REVIEW PAGE
  (/review/:attemptId, ReviewPage.tsx, LISTENING only): post-submit study view in
  the exam-player style — full recording on top (PracticeAudioPlayer autoStart
  ={false}), split panes with a draggable divider: LEFT the paper with the
  student's answers marked right/wrong plus the keys, RIGHT the part transcript.
  Data comes from the review-attempt edge function (owner-only: full content incl.
  answers + transcripts + the graded items — safe ONLY post-submit; get-test keeps
  stripping pre-submit). Transcript convention: plain text, `SPEAKER: line` turns,
  inline [Qn] where question n is answered (rendered as brand badges). The two
  real tests currently carry PLACEHOLDER transcripts (plausible scripts written
  around the official keys, 2026-07-06) — the owner will supply the real ones.
  Entry point: "Review with audio & transcript" button on listening results. Six renderers in
  src/components/test/listening/ dispatched by ListeningPartRenderer. get-test v4 /
  submit-test v5 strip answers+explanations+transcripts and grade skill-agnostically
  (groups flattened). Admin: /admin/tests/new/listening + skill-dispatching edit
  router; dual audio upload + map image upload; server validator validate-listening.ts
  (admin-tests v3). Catalog split /reading + /listening (shared TestCatalog); dashboard
  + home carry per-attempt skill (src/lib/skills.ts). Verified end-to-end 2026-07-06:
  sanitization (no answers/transcripts pre-submit), grading (gap multi-spellings +
  grouped Part 5), history skill, public asset URLs 200. Writing/Speaking still NOT built.

## Design system v3 ("friendly scholar" — keep new UI consistent with this)
- Voice: warm, friendly ed-tech with a cat mascot (Cathoven-inspired), in
  Cefrly's purple. Lavender-tinted neutrals, soft shadows, big radii, bold
  Nunito. The exam player stays calmer than the rest (students concentrate).
- Tokens in src/index.css @theme: page #f8f7fc, ink/ink-soft/ink-faint (violet
  grays), heading, brand #3f2682 (primary buttons, active nav/tabs), brand-deep
  (hover), accent #8b5cf6 + accent-deep (bright CTA — sidebar CTA, marked dots;
  use sparingly), brand-soft #efeafd (fills, chips, bubbles), line, ok,
  sun/sun-soft/sun-ink (yellow badges). Semantic panels: rose/emerald/amber
  -50/-200/-800, rounded-xl.
- Fonts: Nunito 400/600/700/800 (UI); Source Serif 4 ONLY inside reading
  passages (.passage sets it). Numbers use `tnum`.
- Buttons: primary `rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white
  hover:bg-brand-deep`; secondary same shape `border border-line bg-white
  text-ink hover:border-ink-faint`; accent CTA (sidebar) `bg-accent
  hover:bg-accent-deep`; text links `font-bold text-brand hover:underline`.
- Shapes: cards `rounded-2xl border border-line bg-white shadow-card`; controls
  rounded-xl; chips/badges rounded-full. Tab strips: white pill container
  (rounded-xl border-line p-1), active tab `rounded-lg bg-brand text-white
  font-bold`. Headings font-extrabold; interactive text font-bold. Selected
  answer states = brand-soft wash + brand border + font-bold. ink-faint is
  decorative-only (fails WCAG AA); informational muted text uses ink-soft.
- MASCOT (in-app): src/components/Cat.tsx — original flat violet cat, poses per
  context: read (hero), peek (spare accent), avatar (header account button).
  The results header's celebrate/encourage SVG poses were REPLACED 2026-07-06
  by public/cat-read-grey.png for ALL bands (the grey reading-book cat; keeps
  .cat-bob on B2/C1) — the band-reactive voice lives in the bubble blurb. The
  nap pose in EmptyState.tsx was REPLACED 2026-07-06 by public/cat-bored.png
  (user-supplied grey bored lounger on a purple/yellow mat, 796×520; its purple
  "hmph" notice marks are KEPT — unlike baked z's nothing duplicates them;
  script scratchpad process_bored_cat.py); non-nap EmptyState poses still use
  the SVG Cat. Never use external cat art.
  The mascot may be funny/deadpan on non-exam surfaces. Empty states use
  <EmptyState pose title hint action>, not plain text panels. (The SVG `welcome`
  pose exists in Cat.tsx but is unused now that login owns its own design.)
- LOGIN / SIGNUP (src/pages/AuthPage.tsx) is a user-owned imported design from
  the claude.ai Design tool ("Cefrly Welcome"). It deliberately uses its OWN
  exact palette (brand #3B2C86, page #F6F4FB, link #6D4FE0, focus #8A63E8, ink
  #2E2A47, input bg #FAF8FE, borders #ECE7F8/#EFEBF8) via Tailwind arbitrary
  values — slightly off the app tokens ON PURPOSE; do not "normalize" it to the
  tokens.
- AUTH ADDITIONS (beyond the original import): (1) src/components/CozyScene.tsx
  — a decorative "study nook" SVG vignette (wall clock, steaming mug, potted
  plant on books, book stack) in soft monochrome lavender, absolutely positioned
  bottom-right of the brand panel to fill the empty space beside the cat
  (aria-hidden, z-[1] behind the cat which is z-[2]). (2) A "Continue with
  Google" button (GoogleIcon) calling supabase.auth.signInWithOAuth({provider:
  'google', redirectTo: origin+from}) — REQUIRES the Google provider enabled in
  the Supabase dashboard + origin added to allowed redirect URLs, else it errors
  gracefully. (3) The account toggle is now a divider ("No account yet? Sign up"
  / "Already have an account? Log in") and a reassurance card ("Your progress is
  safe with us." with ShieldIcon). All in the auth palette above.
- Mascot: THREE cats, one picked at random per page load (CATS[] in
  AuthPage.tsx, Math.random) so different visitors see different mascots —
  public/cat-sleeping.png (REPLACED 2026-07-06 with user-supplied art: the GREY
  cat asleep curled on a lavender cushion, matching the band-cat style;
  1065×700, white bg flood-filled transparent, processed via scratchpad
  process_sleeping_cat.py — the old purple design-project cat is gone),
  public/cat-surprised.png (the round wide-eyed grey cat sitting on a lavender
  cushion — the FULL-BODY asset, restored; see the surprised-cat note below),
  and public/cat-flop.png (added 2026-07-06: the belly-up flop sleeper ON its
  lavender cushion — the user replaced the first cushionless version with the
  "full" art; grey, 917×700, same pipeline). Each has its own personality copy (hello/peek/bye/
  quips; sleeping+surprised verbatim from the source design, flop written in
  the same deadpan voice); only sleepy cats show zzz's. The zzz's are ONLY the
  animated JSX overlay (.zzz-1/2/3 + zzz-float) — the user's standing rule: any
  baked z glyphs in a sleeping-cat asset must be ERASED before install (done
  for both sleepers: baked z's dropped as small disconnected components, area
  < 20000px). CatDef.zzzPos (optional Tailwind classes) anchors the overlay
  over THAT cat's head — flop uses left-[36%] top-[38px]; default (curled
  sleeper) is left-[46%] top-[34px].
  Each CatDef carries its OWN `frame` (Tailwind size + anchor of the poke-button
  box). surprised + flop share h-[clamp(230px,33vh,300px)] max-w-[480px]; the
  curled sleeper uses a SHORTER h-[clamp(190px,27vh,245px)] because its art is
  a wide low composition that rendered visibly bigger at the shared height
  (user call 2026-07-06) — match visual cat/cushion MASS across cats, not
  frame height. The img fills its frame with
  object-contain object-[left_bottom]. do NOT crop the asset or force a fixed
  auto-height. Preview a specific alternative with ?cat=<key> (e.g.
  /login?cat=surprised, or a numeric index) — otherwise it's random per load.
  Add a new alternative = drop a PNG in /public and append a CATS[] entry
  (key + src + frame + copy). A speech bubble reacts to context
  (greet → peek on password focus → farewell on submit → click cat for random
  quips), the cat floats zzz's (animated overlay) and breathes. Password has a
  show/hide eye toggle. Supabase auth + login/signup mode adaptation are
  preserved under the visuals. Motion keyframes (cat-breathe, zzz-float,
  bubble-in) live in index.css, reduced-motion gated. The grey "surprised" cat
  (public/cat-surprised.png) is the FULL-BODY 1180x1119 RGBA asset, restored
  from the design project — resized to 738x700 and palette-quantized to ~51 KiB
  (looks identical; flat cartoon). HOW IT WAS PULLED past the 256 KiB read cap:
  DesignSync/read_file (get_file) truncates big files (that truncation is what
  produced the old headless 716x280 "peek" crop). Instead, call the design MCP
  directly — POST https://api.anthropic.com/v1/design/mcp with the Bearer token
  from ~/.claude/.credentials.json → designOauth.accessToken (sk-ant-o…),
  tools/call render_preview {project_id, path} → returns a short-lived
  serve_url on <project_id>.claudeusercontent.com (self-authing ?t= token).
  GET that serve_url WITH A BROWSER User-Agent + Referer https://claude.ai/
  (plain urllib 403s) to download the untruncated bytes. Keep serve_url internal
  — never surface it. Design project: MCP project
  0635101f-754f-4e23-939f-816bec3ad3fa ("Cefrly Welcome"/"Lazy cat welcome
  page"), after /design-login.
- HOME (src/pages/HomePage.tsx) is a PERSONAL DASHBOARD, deliberately NOT a
  reading-tests list (that's /reading; My results is /dashboard). It adapts to
  the signed-in student's attempts:
  · No attempts → greeting + "Discover your real CEFR level" hero (read cat +
    demo BandRuler + Start-first-test CTA) + "How it works" 3 steps.
  · Has attempts → greeting + LevelSnapshot (big band + count-up best score +
    the reading-book cat top-right — the SAME /cat-read-grey.png as the hero,
    kept on purpose so the cat "never disappears" after the first attempt
    (user call 2026-07-06) + BandRuler(best) + "N more marks to reach <next>")
    + stat tiles (Tests taken/
    Average/Best/Latest) + a Score-trend Sparkline (raw scores over time with
    faint 10/18/28 band guides; shown at ≥2 attempts) + Recent-activity teaser
    (last 3 → See all).
  The ruler cat is band-reactive via RULER_CAT (Record<Band,{src,w}> in
  HomePage.tsx): four user-supplied grey cats that get happier AND rounder per
  band — /cat-band-below-b1.png (unimpressed) → b1 (smiling) → b2 (beaming,
  chubby) → c1 (blissful chonk). Processed 2026-07-06 like cat-sit.png
  (white bg flood-filled transparent, lavender floor shadow kept, 520px tall,
  palette-quantized; script pattern in scratchpad process_band_cats.py). `w` is
  the rendered width at the shared 52px height (40/41/45/53); it feeds
  BandRuler's topperHalfWidth prop (default 21) which clamps the fill position
  so wider cats never hang off the scale's ends. The demo ruler (no-attempts
  hero) fills to the C1 boundary and seats the C1 CHONK there — the cat at the
  C1 position must always be the C1 cat (user call 2026-07-06); the neutral
  /cat-sit.png stays for surfaces with no band position at all. Preview any
  band's snapshot
  (cat + quip + fill) with /?band=C1 (case-insensitive; optional &score=NN,
  defaults to a mid-band score) — same spirit as /login?cat=; only the
  LevelSnapshot is overridden, stats/sparkline/activity stay real.
  Both states end with the "Your CEFR skills" roadmap (Reading Available →
  Practice; Listening/Writing/Speaking "soon") — the one surface that shows
  Cefrly as a full 4-skill platform. Greeting name comes from Google
  user_metadata.full_name/name else the email local part.
- Results header: friendly light card — big Nunito band label + count-up score,
  the grey reading-book cat (public/cat-read-grey.png, bobbing on B2/C1) + a
  speech bubble (bg-brand-soft, blurb text) reacting to the band, BandRuler
  fill below. No dark panels anywhere.
- <BandRuler band score animate demo tone> (src/components/BandRuler.tsx): ruled
  CEFR scale (thresholds 10/18/28) with a fill that rises to the student's level;
  `demo` fills to the C1 boundary (signed-out hero, auth). Brand lockup:
  src/components/Logo.tsx.
- Confirm dialogs: src/components/ConfirmDialog.tsx — Cefrly's OWN alert (the
  startled cat-surprised.png + calm copy; safe action autofocused; Escape/
  backdrop cancel; confirm tone 'brand' for commits, 'rose' for leaving).
  TestPage uses it for Exit and incomplete-Submit (added 2026-07-06 — the user
  rejected native window.confirm popups). Never use window.confirm on student
  surfaces; the admin pages still do (acceptable there for now).
- Loading: shimmer skeletons (src/components/Skeleton.tsx), not "Loading…" text
  (bare text ok for transient route guards). Motion hooks (count-up, in-view
  reveals) in src/lib/motion.ts. Motion classes (.reveal/.page-enter/.ruler-*/
  .cat-bob/.skeleton) live in index.css, all disabled under
  prefers-reduced-motion; transform hovers need `motion-safe:`; the @media print
  block forces opacity-0 rows visible.
- DEV ONLY: /cat-preview route in App.tsx shows the mascot pose sheet — remove
  before launch.

## Onboarding (asked ONCE per account — built 2026-07-06)
- profiles carries the wizard answers (migration 0009: onboarded_at, first_exam
  first_time/took_mock/took_real, self_level unknown/below_B1..C1, target_band
  B1/B2/C1, exam_month date = first of month or null, weak_areas text[] ⊆
  {reading,listening,writing,speaking,vocabulary,timing}, daily_minutes
  15/30/60/120, heard_from telegram/instagram/youtube/friend_teacher/
  learning_centre/milliymock/google/other + heard_from_note). CHECK constraints
  + column-level UPDATE grants (same security model as roles: users can write
  only name + these columns; role stays locked). Data is deliberately collected
  now to feed the future STUDY-ROADMAP feature + attribution analytics.
- /welcome = full-screen 7-step wizard (WelcomePage, outside the app shell):
  first-exam → self-level → goal (GoalBandPicker: B1/B2/C1 stops on a
  ruler-style radio track, the band cat slides to the selection) → exam month
  (MonthGrid: next 12 months + "Haven't decided" = null) → weak-area chips →
  daily time → heard-from (+free text for Other) → finale with the target-band
  cat. Draft survives refresh via localStorage 'cefrly-onboarding-draft'; cat
  quip per step; Continue gated per step.
- ASKED-ONCE GATE: auth context fetches onboarded_at together with role;
  ProtectedRoute holds rendering until the profile row arrives (role===null),
  then: no stamp → funnel everything to /welcome; stamped → /welcome redirects
  home. So the wizard never reappears on later logins (verified incl. hard
  reload + direct /welcome nav). markOnboarded() lifts the gate ONLY on the
  finale CTA — flipping it right after save would bounce the finale screen.
  Existing accounts (incl. owners) meet the wizard once on their next login.
- API: fetchMyProfile/saveOnboarding/updateStudyPrefs in src/lib/api.ts
  (update scoped by own id; returns the updated row). Study prefs (goal/month/
  weak areas/time) are editable at /settings (SettingsPage; Save enables on
  dirty, "Saved ✓" on success); attribution is shown read-only there
  (write-once by convention, not constraint).
- Dashboard personalization: BandRuler `goal` prop plants a "Goal" marker at
  the target band's threshold — a white rounded pill (flag icon + GOAL in
  accent-deep, ring-accent/40, shadow-card) with a short accent stem down to
  the rule, clamped 28px inside the scale ends (z-0, behind the cat; the lone
  13px outline flag it replaced read as noise — user call 2026-07-06); LevelSnapshot swaps the
  "N more marks" line to "…to reach your goal (B2)" / "Goal reached — aim
  higher?" (falls back to next-band copy without a goal); exam-countdown chip
  (sun-soft, ClockIcon, links to /settings; "Exam in ~N weeks/months", past →
  "update it") in the greeting row; weak skills get a "Your focus" badge on
  the skills roadmap. Shared controls: src/components/choice.tsx (OptionCard/
  Chip/MonthGrid) and src/components/BandCat.tsx (BAND_CAT/BAND_QUIP/BandCat/
  QuipBubble — moved out of HomePage; GoalBandPicker reuses them).
