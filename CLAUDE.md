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
- Local env goes in .env.local (gitignored). Never commit keys.
