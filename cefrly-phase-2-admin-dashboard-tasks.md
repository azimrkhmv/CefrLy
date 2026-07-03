# Cefrly — Phase 2: Admin Dashboard — Task List for Claude Code

**You are Claude Code. Execute this entire phase autonomously, task by task, in order.**
This builds the admin dashboard so tests can be added/edited/published through the website
instead of loading JSON by hand — with a proper role system. Reading only.

═══════════════════════════════════════════════════════════════════════
GROUND RULES (read before Task 1 — these prevent drift)
═══════════════════════════════════════════════════════════════════════
1. **Read `CLAUDE.md` and the existing codebase first.** Reuse what's already there. Do NOT
   invent new schemas, file names, folders, table names, function names, or "seed" plumbing.
   Canonical schema = **schema v2** (in CLAUDE.md). Canonical seeded test slug = `reading-mock-19`.
2. **Reading only.** Do NOT build Listening / Writing / Speaking anything.
3. **Work in order.** After each task, run its **Acceptance check**. Only continue when it
   passes. Then `git commit` (`phase2: task N - <summary>`).
4. **Security invariant:** the browser NEVER reads or writes the `tests` table directly, and
   NEVER changes user roles directly. All admin reads/writes go through admin-gated Edge
   Functions using the `service_role` key. Frontend uses only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
5. **Never weaken validation.** Reject invalid tests with clear messages; never silently "fix".
6. **Be autonomous.** Don't ask the owner to decide things. Only pause if truly blocked (a
   missing secret, or the one manual super-admin promotion in Task 1). State the blocker in one line.
7. **Apply DB changes** via the linked Supabase CLI (migrations). If one can't be applied
   automatically, print the exact SQL and pause for the owner to run it once.

═══════════════════════════════════════════════════════════════════════
ROLE MODEL (the backbone of this phase — enforce everywhere)
═══════════════════════════════════════════════════════════════════════
Three roles on `profiles.role`:
- **`student`** (default): takes tests. No admin access at all.
- **`admin`**: ALL content actions — create, edit, publish, unpublish, archive (delete) tests.
  **CANNOT** manage users/roles. Cannot reach the "Admins" page.
- **`super_admin`** (the owner): everything an admin can do, **PLUS** manage admins — list
  users, promote a user to `admin`, demote an `admin` back to `student`.

Enforcement lives on the SERVER (Edge Functions), not just the UI:
- `requireAdmin(jwt)` → allow if role ∈ {`admin`, `super_admin`}, else 403. Gates all CONTENT actions.
- `requireSuperAdmin(jwt)` → allow only if role = `super_admin`, else 403. Gates all USER-MANAGEMENT actions.
The UI hides what a role can't do, but the server is the real gate — always check there too.

═══════════════════════════════════════════════════════════════════════
CONTEXT — the existing system you are extending (do not recreate)
═══════════════════════════════════════════════════════════════════════
**Stack:** Vite + React + TypeScript + Tailwind + React Router + TanStack Query; Supabase
(Postgres, Auth, Storage, Edge Functions); Vercel + Supabase hosting.

**Existing tables:**
- `profiles(id, name, source, created_at)` — one per user; `id` = auth user id. (Task 1 adds `role`.)
- `tests(id, slug, skill, title, content jsonb, status, created_at)` — `content` = FULL test incl.
  answers; `status` ∈ `'draft'|'published'` (Task 4 adds `'archived'`). No browser select policy.
- `attempts(id, user_id, test_id, responses, section_scores, band, status, started_at, submitted_at)`.
- view `test_catalog` — published tests only, no answers (student browsing).

**Existing Edge Functions:** `get-test` (slug → answer-stripped test for students); `score-attempt`
(grades server-side, returns results + explanations).

**Band mapping (Reading, raw correct /35):** 28–35 → C1 · 18–27 → B2 · 10–17 → B1 · 0–9 → below_B1.

**Schema v2 (Reading):**
```
ReadingTest = { id, skill:'reading', targetLevels:['B1','B2','C1'], durationSec:3600, parts:Part[5] }
Part = { id, number:1|2|3|4|5, layout:'cloze_from_text'|'match_texts'|'match_headings'|'passage_questions',
         instructions, passage?:{title?,html?,paragraphs?:{label,html}[]}, optionPool?:{key,label}[], items:Item[] }
Item =
 | { id, type:'gap',   points:1, answer:string[], caseSensitive?:false, explanation }
 | { id, type:'match', points:1, prompt, answer:string /*optionPool key*/, explanation }
 | { id, type:'mcq',   points:1, prompt, options:{key,label}[], answer:string, explanation }
 | { id, type:'tfng',  points:1, prompt, thirdOptionLabel:'Not Given'|'No Information',
       answer:'true'|'false'|'not_given', explanation }
explanation = { location, quote, reasoning }
```
**Rigid Reading structure (why the admin form is a fixed template, not a freeform editor):**
Part 1 = 6 `gap` · Part 2 = 8 `match` (optionPool A–J, 10) · Part 3 = 6 `match` (optionPool headings, 8–9) ·
Part 4 = 9 mixed `mcq`+`tfng` · Part 5 = 6 mixed `gap`+`mcq`. **Total = 35, always.**

═══════════════════════════════════════════════════════════════════════
TASKS
═══════════════════════════════════════════════════════════════════════

## Task 1 — Roles
**Goal:** three roles exist, and the owner is the super admin.
**Build:**
- Migration: add `role text not null default 'student'` to `profiles` (values `'student'|'admin'|'super_admin'`).
- Keep `handle_new_user` defaulting new users to `'student'`.
- Provide the one-line SQL to make the owner the super admin, and **pause** so they run it for
  their own account (only they know their email):
  `update public.profiles set role='super_admin' where id=(select id from auth.users where email='OWNER_EMAIL');`
**Acceptance:** `profiles` has a `role` column; after the owner runs the SQL, their row = `super_admin`;
all other users = `student`.
**Then commit.**

## Task 2 — Admin routing + shell (role-aware)
**Goal:** an `/admin` area, with the Admins page reserved for the super admin.
**Build:**
- Routes: `/admin/tests` (list), `/admin/tests/new`, `/admin/tests/:slug` (edit), `/admin/admins` (super-admin only).
- Guards reading `profiles.role`:
  - `/admin/*` → allowed for `admin` and `super_admin`; students → student home; logged-out → `/login`.
  - `/admin/admins` → allowed for `super_admin` ONLY; a plain `admin` hitting it is redirected to `/admin/tests`.
- Admin shell: header "Cefrly Admin" + nav (Tests, + New test). Show the **Admins** nav link ONLY when
  the current user is `super_admin`. Clean, mobile-friendly Tailwind, consistent with the app.
**Acceptance:** super_admin sees Tests + Admins nav and can open both; a plain admin sees Tests only
and is redirected away from `/admin/admins`; a student is redirected off `/admin/*`; logged-out → login.
**Then commit.**

## Task 3 — Admin Edge Function: content read (`admin-tests`)
**Goal:** a secure function admins use to read tests (drafts + answers included).
**Build:**
- Edge Function `admin-tests`. Shared helper `requireAdmin(jwt)` (allow `admin`|`super_admin`, else 403).
- Actions (via `action` in body): `list` → all non-archived tests (id, slug, skill, title, status,
  created_at), NO content. `get` → slug → the ONE full test `content` (with answers) for editing.
- `service_role` key only (Edge secret).
**Acceptance:** `list` as admin or super_admin returns rows incl. drafts; as student → 403; `get`
with `reading-mock-19` returns the full test incl. answers.
**Then commit.**

## Task 4 — Admin Edge Function: content write (add to `admin-tests`)
**Goal:** admins can create/update, publish/unpublish, and archive tests — validated server-side.
**Build (same `admin-tests` function, still `requireAdmin`):**
- `upsert` → full schema-v2 test + intended `status`. **Validate before writing:**
  exactly 5 parts, `number` 1..5 in order with the correct `layout`; total items = **35** with per-part
  6/8/6/9/6; every `{{itemId}}` marker has a matching `gap` item and every `gap` item has non-empty
  `answer[]`; every `match` answer exists in its part's `optionPool`; every `mcq` answer exists in its
  own `options`; every `tfng` answer ∈ {true,false,not_given} with `thirdOptionLabel` set; `slug` present
  (unique on insert, exists on update). On failure return `{ok:false, errors:[...]}` with a specific
  message per problem and **write nothing**. On success upsert and return `{ok:true, slug}`.
- `setStatus` → slug + `'draft'|'published'`.
- `delete` → **soft delete**: set `status='archived'` (recoverable). Exclude `archived` from `list` and `test_catalog`.
**Acceptance:** valid `upsert` (use `reading-mock-19` content as fixture) writes and appears; a broken
copy (missing answer, or 34 items) returns clear errors and writes nothing; `setStatus` flips
draft/published and shows in `test_catalog`; `delete` archives (test disappears from list, still in DB).
**Then commit.**

## Task 5 — Tests list page (`/admin/tests`)
**Goal:** see and manage every test.
**Build:**
- Fetch via `admin-tests`→`list` (TanStack Query). Table: title, slug, skill, status badge, created date.
- Row actions (available to `admin` and `super_admin`): **Edit** → `/admin/tests/:slug`;
  **Publish/Unpublish** → `setStatus`; **Archive** → `delete` (with confirm dialog).
- "+ New test" → `/admin/tests/new`. Invalidate the query on any success so the list updates.
**Acceptance:** page lists `reading-mock-19` + any drafts with correct status; publish toggles the
badge and changes what students see; archive removes it from the list.
**Then commit.**

## Task 6 — Reading template form — CREATE (`/admin/tests/new`)
**Goal:** create a new Reading test through a structured form (no JSON by hand).
**Build a fixed-template form mirroring the rigid Reading paper:**
- **Meta:** title; slug (auto from title, editable); `durationSec` default 3600; `id`=slug.
- **Part 1 (cloze_from_text):** passage title + HTML; 6 gap rows (q1..q6) each: accepted answer(s) +
  explanation (location, quote, reasoning). Help text: use `{{q1}}`…`{{q6}}` markers in the passage.
- **Part 2 (match_texts):** optionPool A–J (10); 8 text items each: prompt + correct optionPool key + explanation.
- **Part 3 (match_headings):** paragraphs (I–VI + html); optionPool of 8–9 headings; 6 items each:
  correct heading key + explanation.
- **Part 4 (passage_questions):** long passage; 9 items, each either `mcq` (prompt + A–D options +
  correct key) or `tfng` (prompt + thirdOptionLabel + correct value); ordering and mcq/tfng split free
  (don't hard-code 4+5).
- **Part 5 (passage_questions):** academic passage; 6 items: summary `gap` items + `mcq` items.
- Live client-side validation MIRRORING the server checks ("35/35", "every gap has an answer", …);
  server stays the source of truth.
- **Save** assembles schema-v2 and calls `admin-tests`→`upsert` with `status:'draft'`; show server
  errors clearly; on success go to the edit page for that slug.
**Acceptance:** filling a small valid test and saving creates a draft that (a) passes server validation
and (b) renders in the EXISTING student player via `get-test`. An incomplete form surfaces exact server
errors and creates nothing.
**Then commit.**

## Task 7 — Reading template form — EDIT (`/admin/tests/:slug`)
**Goal:** open an existing test in the same form, change it, save.
**Build:** load via `admin-tests`→`get`, prefill the Task 6 form (reuse the same component; create vs
edit differ only by prefill + insert/update). Save calls `upsert` (update). Add Publish/Unpublish here too.
**Acceptance:** opening `reading-mock-19` prefills all parts/answers; editing a question and saving
updates it; after Publish the change is live for students.
**Then commit.**

## Task 8 — Manage admins (super-admin only) — `admin-users` + `/admin/admins`
**Goal:** the owner can add and remove admins; nobody else can.
**Build:**
- Edge Function `admin-users`, gated by `requireSuperAdmin(jwt)` (super_admin only, else 403).
  Actions: `listUsers` → all users with email, name, role; `setUserRole` → takes a user id + new role
  (`'student'|'admin'`), updates `profiles.role`. **Guardrails:** `setUserRole` must NOT allow setting
  or removing `super_admin` (the owner role is not assignable/removable via the API — protects against
  lockout); reject attempts to change one's own role.
- Page `/admin/admins` (super_admin only, per Task 2 guard): list users with their role; a control to
  promote a `student` to `admin` and demote an `admin` to `student`. Calls `admin-users`.
**Acceptance:** as super_admin, `/admin/admins` lists users and promoting/demoting changes their role
(verify a promoted user can then reach `/admin/tests`, and a demoted one is redirected off it); as a
plain `admin`, `/admin/admins` is unreachable AND a direct call to `admin-users` returns 403;
`setUserRole` cannot grant/remove `super_admin`.
**Then commit.**

## Task 9 — End-to-end verification + polish
**Goal:** prove the whole thing and tidy up.
**Verify the full loop with no files and no SQL editor:**
- As super_admin: New test → fill → Save (draft) → fix any validation errors → preview in the student
  player → Publish → confirm it appears on the student home, can be taken and scored.
- As super_admin: promote a test user to `admin`; confirm that admin can do all test work but cannot
  see or reach `/admin/admins` and gets 403 from `admin-users`.
- Ensure admin pages are mobile-friendly and match the app's styling.
- Confirm via the network tab: the browser never reads/writes `tests` directly and never changes roles
  directly — only through the admin-gated Edge Functions.
**Acceptance (Phase 2 Definition of Done):**
- [ ] Three roles: student / admin / super_admin. Owner is super_admin.
- [ ] Only admins/super_admins reach `/admin`; only super_admin reaches `/admin/admins`.
- [ ] `admin-tests`: list/get/upsert/setStatus/archive, gated by `requireAdmin`, service_role only.
- [ ] `admin-users`: listUsers/setUserRole, gated by `requireSuperAdmin`; can't grant/remove super_admin.
- [ ] Server-side validation rejects malformed tests with specific errors and writes nothing.
- [ ] Tests list shows drafts + published, with working publish/unpublish/archive.
- [ ] A brand-new Reading test can be created entirely through the form and renders + scores.
- [ ] An existing test can be edited through the form.
- [ ] The super admin can promote/demote admins; a plain admin cannot.
- [ ] No JSON files or SQL editor needed to add a test.
- [ ] Browser never touches the `tests` table or user roles directly.
**Then commit** (`phase2: complete - admin dashboard + roles (reading)`).

═══════════════════════════════════════════════════════════════════════
OUT OF SCOPE (later phases)
═══════════════════════════════════════════════════════════════════════
Listening/Writing/Speaking forms; bulk import; AI-assisted item generation; analytics; a
publish-review/approval gate. When Reading admin + roles are done and committed, stop and report.
