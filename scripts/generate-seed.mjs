// Generates supabase/seed/seed.sql from the canonical test JSON, validating
// the structure against the rigid reading-paper spec first.
// Run with: npm run seed:generate
import { readFileSync, writeFileSync } from 'node:fs'

const jsonUrl = new URL('../supabase/seed/reading-test-1.json', import.meta.url)
const test = JSON.parse(readFileSync(jsonUrl, 'utf8'))

// --- validation -------------------------------------------------------------
const EXPECTED_ITEM_COUNTS = [6, 8, 6, 9, 6] // parts 1..5
const EXPECTED_LAYOUTS = [
  'cloze_from_text',
  'match_texts',
  'match_headings',
  'passage_questions',
  'passage_questions',
]

if (!Array.isArray(test.parts) || test.parts.length !== 5) {
  throw new Error(`Expected 5 parts, got ${test.parts?.length}`)
}
test.parts.forEach((part, index) => {
  if (part.number !== index + 1) throw new Error(`Part at index ${index} has number ${part.number}`)
  if (part.layout !== EXPECTED_LAYOUTS[index]) {
    throw new Error(`Part ${part.number}: expected layout ${EXPECTED_LAYOUTS[index]}, got ${part.layout}`)
  }
  if (part.items.length !== EXPECTED_ITEM_COUNTS[index]) {
    throw new Error(
      `Part ${part.number}: expected ${EXPECTED_ITEM_COUNTS[index]} items, got ${part.items.length}`,
    )
  }
  for (const item of part.items) {
    if (!item.explanation?.location || !item.explanation?.quote || !item.explanation?.reasoning) {
      throw new Error(`Item ${item.id}: incomplete explanation`)
    }
    if (item.type === 'gap' && (!Array.isArray(item.answer) || item.answer.length === 0)) {
      throw new Error(`Item ${item.id}: gap answer must be a non-empty array`)
    }
  }
})

const totalItems = test.parts.reduce((sum, part) => sum + part.items.length, 0)
if (totalItems !== 35) throw new Error(`Expected 35 items in total, got ${totalItems}`)

// Every {{marker}} in passage html must reference a real item id.
const itemIds = new Set(test.parts.flatMap((part) => part.items.map((item) => item.id)))
const markers = [...JSON.stringify(test).matchAll(/\{\{\s*([\w-]+)\s*\}\}/g)].map((m) => m[1])
for (const marker of markers) {
  if (!itemIds.has(marker)) throw new Error(`Gap marker {{${marker}}} has no matching item`)
}

// match/mcq answers must exist in their option pool / options.
for (const part of test.parts) {
  const poolKeys = new Set((part.optionPool ?? []).map((option) => option.key))
  for (const item of part.items) {
    if (item.type === 'match' && !poolKeys.has(item.answer)) {
      throw new Error(`Item ${item.id}: answer "${item.answer}" not in optionPool`)
    }
    if (item.type === 'mcq' && !item.options.some((option) => option.key === item.answer)) {
      throw new Error(`Item ${item.id}: answer "${item.answer}" not in options`)
    }
  }
}

// --- SQL generation ----------------------------------------------------------
const contentJson = JSON.stringify(test, null, 2)
if (contentJson.includes('$seed$')) throw new Error('Content may not contain the $seed$ delimiter')

const levels = `{${test.targetLevels.join(',')}}`
const slug =
  test.slug ??
  test.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const sql = `-- Generated from reading-test-1.json by scripts/generate-seed.mjs. Do not edit by hand.
-- Run this in the Supabase SQL editor (or via supabase db execute) AFTER the migrations.

insert into public.tests (id, slug, title, skill, target_levels, duration_sec, status)
values ('${test.id}', '${slug}', '${test.title.replace(/'/g, "''")}', '${test.skill}', '${levels}', ${test.durationSec}, 'published')
on conflict (id) do update
  set slug = excluded.slug,
      title = excluded.title,
      target_levels = excluded.target_levels,
      duration_sec = excluded.duration_sec,
      status = 'published';

insert into public.test_content (test_id, content)
values ('${test.id}', $seed$${contentJson}$seed$::jsonb)
on conflict (test_id) do update
  set content = excluded.content,
      updated_at = now();
`

const outUrl = new URL('../supabase/seed/seed.sql', import.meta.url)
writeFileSync(outUrl, sql)
console.log(`OK: wrote supabase/seed/seed.sql (${totalItems} items, ${markers.length} gap markers)`)
