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

## Conventions
- TypeScript strict. Clear folders (src/pages, src/components, src/lib, src/types). Small components.
- Keep it simple — phase 1 of a large project. Do NOT build Listening/Writing/Speaking yet.

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
  context: read (hero), nap (empty states via src/components/EmptyState.tsx),
  celebrate (results B2/C1, add .cat-bob), encourage (results below B2), peek
  (spare accent), avatar (header account button). Never use external cat art.
  The mascot may be funny/deadpan on non-exam surfaces. Empty states use
  <EmptyState pose title hint action>, not plain text panels. (The SVG `welcome`
  pose exists in Cat.tsx but is unused now that login owns its own design.)
- LOGIN / SIGNUP (src/pages/AuthPage.tsx) is a user-owned imported design from
  the claude.ai Design tool ("Cefrly Welcome"). It deliberately uses its OWN
  exact palette (brand #3B2C86, page #F6F4FB, link #6D4FE0, focus #8A63E8, ink
  #2E2A47, input bg #FAF8FE, borders #ECE7F8/#EFEBF8) via Tailwind arbitrary
  values — slightly off the app tokens ON PURPOSE; do not "normalize" it to the
  tokens. Mascot: public/cat-sleeping.png — the full purple cat asleep on a
  lavender cushion (pulled from the design project's uploads/, background
  flood-filled to transparent so it seats seamlessly). It renders via the
  design's own container (max-w-[480px], h-[clamp(230px,33vh,300px)],
  object-contain, object-[left_bottom]) so the WHOLE cushion cat shows at the
  bottom-left — do NOT crop the asset or use a fixed auto-height (an earlier
  crop clipped it; that was wrong). A speech bubble reacts to context
  (greet → peek on password focus → farewell on submit → click cat for random
  quips), the cat floats zzz's and breathes. Password has a show/hide eye
  toggle. Supabase auth + login/signup mode adaptation are preserved under the
  visuals. Motion keyframes (cat-breathe, zzz-float, bubble-in) live in
  index.css, reduced-motion gated. The design's saved assets/cat-*.png are
  head-only crops (stale) and the grey "surprised" cushion cat has no clean
  asset in the synced project — only the purple cushion cat is used. To
  re-import: DesignSync MCP, project 0635101f-754f-4e23-939f-816bec3ad3fa,
  after /design-login.
- Results header: friendly light card — big Nunito band label + count-up score,
  cat + speech bubble (bg-brand-soft, blurb text) reacting to the band, BandRuler
  fill below. No dark panels anywhere.
- <BandRuler band score animate demo tone> (src/components/BandRuler.tsx): ruled
  CEFR scale (thresholds 10/18/28) with a fill that rises to the student's level;
  `demo` fills to the C1 boundary (signed-out hero, auth). Brand lockup:
  src/components/Logo.tsx.
- Loading: shimmer skeletons (src/components/Skeleton.tsx), not "Loading…" text
  (bare text ok for transient route guards). Motion hooks (count-up, in-view
  reveals) in src/lib/motion.ts. Motion classes (.reveal/.page-enter/.ruler-*/
  .cat-bob/.skeleton) live in index.css, all disabled under
  prefers-reduced-motion; transform hovers need `motion-safe:`; the @media print
  block forces opacity-0 rows visible.
- DEV ONLY: /cat-preview route in App.tsx shows the mascot pose sheet — remove
  before launch.
