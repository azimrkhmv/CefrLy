import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchSamples } from '../lib/api'
import { useAuth } from '../lib/auth'
import { hasPremiumAccess } from '../lib/plans'
import { imageUrl } from '../lib/storage'
import { EmptyState } from '../components/EmptyState'
import { TabStrip } from '../components/TabStrip'
import { TestGridSkeleton } from '../components/Skeleton'
import { ArrowRightIcon, LockIcon, MicIcon, PenIcon } from '../components/icons'
import type { Sample, SampleCategory, SampleImage, SampleSkill, SpeakingTurn, VocabItem } from '../types/sample'
import { SAMPLE_CATEGORIES, SAMPLE_SKILLS, sampleSkill, sampleUsesTurns } from '../types/sample'

// Model answers for the two skills Cefrly does NOT test yet, in the real
// Multilevel format. Writing splits into Task 1.1 (informal email), Task 1.2
// (formal email) and Part 2 (forum post); Speaking splits into its four parts
// (1.1 interview, 1.2 photo comparison, 2 photo talk, 3 for/against). The tabs
// are two-tier: a Writing/Speaking skill toggle, then that skill's part sub-
// tabs. Content comes from the `samples` table (published rows, RLS) — authored
// via the admin-samples edge function.

// No CEFR-level chip: the samples aren't level-graded, so we don't assert a
// band we can't verify. The task register still shows in the badge eyebrow
// (e.g. "TASK 1.2 · FORMAL EMAIL").
const CHIP = {
  speaking: { label: 'speaking', className: 'bg-sun-soft text-sun-ink' },
  model: { label: 'model answer', className: 'bg-emerald-50 text-emerald-800' },
}

// Card dressing is derived from the category's skill, not stored per sample.
const chipsFor = (category: SampleCategory): { label: string; className: string }[] =>
  sampleSkill(category) === 'speaking' ? [CHIP.speaking, CHIP.model] : [CHIP.model]

// First part-category of a skill — the sub-tab we land on when the skill toggles.
const firstCategoryOf = (skill: SampleSkill): SampleCategory =>
  SAMPLE_CATEGORIES.find((c) => c.skill === skill)!.key

/** What a Free student sees. Deliberately says what is behind the wall rather
 *  than pretending the library is empty. */
function SamplesLocked() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Samples</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Model answers to real Multilevel writing and speaking tasks.
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-white p-8 text-center shadow-card sm:p-10">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
          <LockIcon width={24} height={24} />
        </span>
        <h2 className="mt-4 text-xl font-extrabold text-heading">
          Model answers are part of Pro and Premium
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-ink-soft">
          Over 100 model answers written to the real exam format — three writing parts and all four
          speaking parts — each with the examiner's task, the full model response and a vocabulary
          glossary.
        </p>
        <Link
          to="/pricing"
          className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          See plans
        </Link>
        <p className="mt-3 text-xs text-ink-soft">
          Practice tests stay free — this unlocks the model answers.
        </p>
      </section>
    </div>
  )
}

export function SamplesPage() {
  const [skill, setSkill] = useState<SampleSkill>('writing')
  const [tab, setTab] = useState<SampleCategory>('writing1_1')
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  // Model answers are part of Pro and Premium. The real gate is RLS on the
  // `samples` table — this only decides what a locked student SEES, and skips a
  // fetch that would come back empty anyway.
  const { plan } = useAuth()
  const locked = !hasPremiumAccess(plan)

  const {
    data: allSamples,
    isLoading,
    error,
  } = useQuery({ queryKey: ['samples'], queryFn: fetchSamples, enabled: !locked })

  const subTabs = SAMPLE_CATEGORIES.filter((c) => c.skill === skill)
  const samples = (allSamples ?? []).filter((s) => s.category === tab)
  const open = samples.find((s) => s.slug === openSlug) ?? null

  const selectSkill = (next: SampleSkill) => {
    setSkill(next)
    setTab(firstCategoryOf(next))
    setOpenSlug(null)
  }
  const selectTab = (next: SampleCategory) => {
    setTab(next)
    setOpenSlug(null)
  }

  if (locked) return <SamplesLocked />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Samples</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Model answers to real Multilevel exam tasks, for the two skills we don’t test yet. See how
          a strong response is built. The Writing and Speaking mock tests are coming soon.
        </p>
      </div>

      {/* Two-tier tabs: skill toggle (Writing / Speaking), then part sub-tabs. */}
      <div className="space-y-3">
        <TabStrip
          ariaLabel="Skill"
          tabs={SAMPLE_SKILLS.map((s) => ({ key: s.key, label: s.label }))}
          value={skill}
          onChange={selectSkill}
        />
        <TabStrip
          ariaLabel={`${skill} parts`}
          tabs={subTabs.map((t) => ({ key: t.key, label: t.partLabel }))}
          value={tab}
          onChange={selectTab}
        />
      </div>

      {isLoading ? (
        <TestGridSkeleton />
      ) : error ? (
        <p className="py-24 text-center text-sm text-rose-700">
          Could not load the samples. {error instanceof Error ? error.message : ''}
        </p>
      ) : open ? (
        <SampleDetail sample={open} onBack={() => setOpenSlug(null)} />
      ) : samples.length === 0 ? (
        <EmptyState
          pose="nap"
          title="No samples here yet"
          hint="New model answers are on the way. Check back soon."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {samples.map((sample) => (
            <SampleGridCard
              key={sample.slug}
              sample={sample}
              onOpen={() => setOpenSlug(sample.slug)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ---- The lesson-style card grid ----------------------------------------------

function SampleGridCard({ sample, onOpen }: { sample: Sample; onOpen: () => void }) {
  const speaking = sampleSkill(sample.category) === 'speaking'
  return (
    <button
      type="button"
      onClick={onOpen}
      // No decorative color bar. The card stays quiet at rest; on hover it lifts
      // with the system's own brand-tinted shadow (not a generic grey drop) and
      // the icon tile fills — one small, motivated payoff, no whole-card jump.
      className="group flex flex-col rounded-2xl border border-line bg-white p-5 text-left shadow-card transition-[border-color,box-shadow] duration-200 hover:border-brand/30 hover:shadow-soft"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand transition-colors duration-200 group-hover:bg-brand group-hover:text-white">
          {speaking ? <MicIcon width={20} height={20} /> : <PenIcon width={20} height={20} />}
        </span>
        <h2 className="min-w-0 font-extrabold leading-snug text-heading">{sample.title}</h2>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {chipsFor(sample.category).map((chip) => (
          <span
            key={chip.label}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${chip.className}`}
          >
            {chip.label}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center border-t border-line pt-3.5">
        <span className="flex items-center gap-1.5 text-sm font-bold text-brand">
          View sample
          <ArrowRightIcon
            width={16}
            height={16}
            className="transition-transform duration-200 motion-safe:group-hover:translate-x-1"
          />
        </span>
      </div>
    </button>
  )
}

// ---- One sample opened -------------------------------------------------------

function SampleDetail({ sample, onBack }: { sample: Sample; onBack: () => void }) {
  const speakingModel = sampleUsesTurns(sample.category)
  const { task, bullets, images, note, model, vocab, why } = sample.content
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
      >
        <ArrowRightIcon width={16} height={16} className="rotate-180" />
        All samples
      </button>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
            {sample.badge}
          </span>
          <h2 className="text-lg font-extrabold text-heading">{sample.title}</h2>
        </div>

        <div className="mt-4 rounded-xl border border-brand/20 bg-brand-soft/50 p-4">
          <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">The task</h4>
          <div className="mt-1.5 space-y-1.5 text-sm font-semibold text-ink">
            {task.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {bullets && (
              <ul className="list-disc space-y-0.5 pl-5 font-medium">
                {bullets.map((bullet, i) => (
                  <li key={i}>{bullet}</li>
                ))}
              </ul>
            )}
          </div>
          {images && images.length > 0 && <SampleImages images={images} />}
          <p className="mt-2 text-xs font-semibold text-ink-soft">{note}</p>
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-extrabold text-heading">
            {speakingModel ? 'Model response' : 'Model answer'}
          </h4>
          <div className="mt-2 space-y-3 rounded-xl bg-page p-4">
            {speakingModel
              ? (model as SpeakingTurn[]).map((turn, i) => (
                  <div key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="w-20 shrink-0 pt-px text-right text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
                      {turn.speaker}
                    </span>
                    <p className="min-w-0 flex-1 text-ink">{turn.text}</p>
                  </div>
                ))
              : (model as string[]).map((paragraph, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink">
                    {paragraph}
                  </p>
                ))}
          </div>
        </div>

        {vocab && vocab.length > 0 && <SampleVocab vocab={vocab} />}

        {why && why.length > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h4 className="text-sm font-extrabold text-emerald-800">Why this scores well</h4>
            <ul className="mt-2 space-y-1.5 text-sm text-emerald-800">
              {why.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="shrink-0 font-bold">
                    ✓
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

// ---- Prompt images (Speaking photos: compare / describe) ----------------------
// One image fills the width; two sit side by side (the "compare these" layout);
// three or more wrap in a grid. Captions ("Photo A") sit under each image.
function SampleImages({ images }: { images: SampleImage[] }) {
  const cols = images.length === 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-2'
  return (
    <div className={`mt-3 grid grid-cols-1 gap-3 ${cols}`}>
      {images.map((image, i) => (
        <figure key={i} className="overflow-hidden rounded-xl border border-line bg-white">
          <img
            src={imageUrl(image.assetPath)}
            alt={image.alt}
            loading="lazy"
            className="max-h-80 w-full bg-page object-contain"
          />
          {image.caption && (
            <figcaption className="border-t border-line px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-ink-soft">
              {image.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}

// ---- Vocabulary glossary (word + meaning + Uzbek) ----------------------------
function SampleVocab({ vocab }: { vocab: VocabItem[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-extrabold text-heading">Vocabulary</h4>
      <dl className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {vocab.map((v, i) => (
          <div
            key={i}
            className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-4"
          >
            <dt className="shrink-0 font-bold text-brand sm:w-44">{v.term}</dt>
            <dd className="min-w-0 flex-1 text-sm text-ink">
              {v.meaning}
              {v.uz && <span className="text-ink-soft"> — {v.uz}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
