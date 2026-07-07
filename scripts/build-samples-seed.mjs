// Generates supabase/seed/samples-seed.sql from the canonical samples JSON,
// validating each sample against the same shape rules the admin-samples edge
// function enforces. Run with: node scripts/build-samples-seed.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const jsonUrl = new URL('../supabase/seed/samples.json', import.meta.url)
const { samples } = JSON.parse(readFileSync(jsonUrl, 'utf8'))

// --- validation (mirrors supabase/functions/admin-samples/validate.ts) -------
const CATEGORIES = ['writing1_1', 'writing1_2', 'writing2', 'speaking']
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

if (!Array.isArray(samples) || samples.length === 0) throw new Error('samples.json: no samples')
const slugs = new Set()

const filledString = (v) => typeof v === 'string' && v.trim().length > 0
const stringArray = (v) => Array.isArray(v) && v.length > 0 && v.every(filledString)
const MAX_IMAGES = 4
const isImage = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && filledString(v.assetPath) && filledString(v.alt) &&
  (v.caption === undefined || filledString(v.caption))
const isVocab = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && filledString(v.term) && filledString(v.meaning) &&
  (v.uz === undefined || filledString(v.uz))

for (const s of samples) {
  const where = `Sample '${s.slug}'`
  if (!SLUG_RE.test(s.slug ?? '')) throw new Error(`${where}: bad slug`)
  if (slugs.has(s.slug)) throw new Error(`${where}: duplicate slug`)
  slugs.add(s.slug)
  if (!CATEGORIES.includes(s.category)) throw new Error(`${where}: bad category ${s.category}`)
  if (!filledString(s.badge) || !filledString(s.title)) throw new Error(`${where}: badge/title missing`)
  if (!Number.isInteger(s.sortOrder)) throw new Error(`${where}: sortOrder must be an integer`)
  const c = s.content
  if (!stringArray(c?.task)) throw new Error(`${where}: content.task must be non-empty string[]`)
  if (c.bullets !== undefined && !stringArray(c.bullets)) throw new Error(`${where}: bad bullets`)
  if (c.images !== undefined) {
    if (!Array.isArray(c.images) || c.images.length === 0 || c.images.length > MAX_IMAGES) {
      throw new Error(`${where}: content.images must be 1–${MAX_IMAGES} image objects when present`)
    }
    if (!c.images.every(isImage)) throw new Error(`${where}: each image needs {assetPath, alt, caption?}`)
  }
  if (c.vocab !== undefined) {
    if (!Array.isArray(c.vocab) || c.vocab.length === 0) throw new Error(`${where}: content.vocab must be non-empty when present`)
    if (!c.vocab.every(isVocab)) throw new Error(`${where}: each vocab item needs {term, meaning, uz?}`)
  }
  if (!filledString(c.note)) throw new Error(`${where}: content.note missing`)
  if (c.why !== undefined && !stringArray(c.why)) throw new Error(`${where}: content.why must be non-empty string[] when present`)
  if (!Array.isArray(c.model) || c.model.length === 0) throw new Error(`${where}: empty model`)
  if (s.category === 'speaking') {
    for (const turn of c.model) {
      if (!filledString(turn?.speaker) || !filledString(turn?.text)) {
        throw new Error(`${where}: speaking model turns need {speaker, text}`)
      }
    }
  } else if (!c.model.every(filledString)) {
    throw new Error(`${where}: writing model must be string paragraphs`)
  }
}

// --- SQL generation -----------------------------------------------------------
const rows = samples.map((s) => {
  const contentJson = JSON.stringify(s.content, null, 2)
  for (const text of [contentJson, s.badge, s.title]) {
    if (text.includes('$seed$')) throw new Error(`Sample '${s.slug}' contains the $seed$ delimiter`)
  }
  return `  ('${s.slug}', '${s.category}', $seed$${s.badge}$seed$, $seed$${s.title}$seed$, $seed$${contentJson}$seed$::jsonb, 'published', ${s.sortOrder})`
})

const sql = `-- Generated from samples.json by scripts/build-samples-seed.mjs. Do not edit by hand.
-- Run in the Supabase SQL editor (or via MCP execute_sql) AFTER migration 0011.

insert into public.samples (slug, category, badge, title, content, status, sort_order)
values
${rows.join(',\n')}
on conflict (slug) do update
  set category = excluded.category,
      badge = excluded.badge,
      title = excluded.title,
      content = excluded.content,
      status = excluded.status,
      sort_order = excluded.sort_order,
      updated_at = now();
`

const outUrl = new URL('../supabase/seed/samples-seed.sql', import.meta.url)
writeFileSync(outUrl, sql)
console.log(`OK: wrote supabase/seed/samples-seed.sql (${samples.length} samples)`)
