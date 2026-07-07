import { useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAttemptReview } from '../lib/api'
import { BAND_INFO } from '../lib/bands'
import { BandRuler } from '../components/BandRuler'
import { useCountUp } from '../lib/motion'
import { COMMUNITY_URL } from '../components/Layout'
import { HighlightedPassage, HighlightedText, type GapFill, type QuoteHighlight } from '../lib/passageHighlights'
import { ArrowRightIcon, BookIcon, CloseIcon, FlagIcon } from '../components/icons'
import type { Item, Part } from '../types/test'
import type { AttemptReview, ItemResult } from '../types/attempt'

// The reading ANALYSIS page (opened from a reading result). Two views:
//  · Overview — band + score + a per-part "answer key" (each question's correct
//    answer, the student's answer and a ✓/✗).
//  · Review & explanations — a split view: the questions with the student's
//    answers on the left, the passage on the right with every answer location
//    highlighted and stamped Qn (see src/lib/passageHighlights) plus Locate /
//    Explain. Listening keeps its own audio review (/review/:attemptId).

export function AnalyzePage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const { data, isLoading, error } = useQuery({
    queryKey: ['attempt-review', attemptId],
    queryFn: () => fetchAttemptReview(attemptId!),
    enabled: !!attemptId,
    staleTime: Infinity,
    retry: 1,
  })

  if (isLoading) {
    return (
      <FullScreen center>
        <p className="text-ink-soft">Loading analysis…</p>
      </FullScreen>
    )
  }
  if (error || !data) {
    return (
      <FullScreen center>
        <div className="space-y-4">
          <p className="text-sm text-rose-700">
            Could not load this analysis. {error instanceof Error ? error.message : ''}
          </p>
          <Link
            to="/dashboard"
            className="inline-block rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
          >
            Back to my results
          </Link>
        </div>
      </FullScreen>
    )
  }
  // Listening has its own audio + transcript review; this page is reading-only.
  if (data.skill === 'listening') return <Navigate to={`/review/${data.attemptId}`} replace />

  return <AnalyzeScreen review={data} />
}

function FullScreen({ children, center }: { children: ReactNode; center?: boolean }) {
  // Portal to <body>: the app shell wraps routes in a transform-animated <main>,
  // which would re-anchor position:fixed — same trick as the exam player.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 bg-page ${
        center ? 'flex items-center justify-center px-6 text-center' : 'flex flex-col'
      }`}
    >
      {children}
    </div>,
    document.body,
  )
}

function AnalyzeScreen({ review }: { review: AttemptReview }) {
  const [view, setView] = useState<'overview' | 'review'>('overview')
  const [partIndex, setPartIndex] = useState(0)

  // Reading parts come back as the FULL content (answers + explanations); the
  // shared review payload types them as listening parts, so narrow here.
  const parts = review.parts as unknown as Part[]

  const resultById = useMemo(() => {
    const map = new Map<string, ItemResult>()
    for (const item of review.items) map.set(item.id, item)
    return map
  }, [review.items])

  // Question numbers = position in the graded list (exam order) — matches the
  // exam player and stays right for single-part drills.
  const numberById = useMemo(() => {
    const map = new Map<string, number>()
    review.items.forEach((item, i) => map.set(item.id, i + 1))
    return map
  }, [review.items])

  const band = review.band ? BAND_INFO[review.band] : null
  const accuracy = review.total > 0 ? Math.round((review.rawScore / review.total) * 100) : 0

  return (
    <FullScreen>
      <header className="shrink-0 border-b border-line bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link
              to={`/results/${review.attemptId}`}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
            >
              <CloseIcon width={18} height={18} />
              <span className="hidden sm:inline">Back to results</span>
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <BookIcon className="hidden shrink-0 text-brand sm:block" width={20} height={20} />
              <div className="min-w-0">
                <h1 className="truncate text-base font-extrabold text-heading">Reading Analysis</h1>
                <p className="hidden truncate text-xs text-ink-soft sm:block">{review.testTitle}</p>
              </div>
            </div>
          </div>
          {/* Overview ↔ deep review toggle (always reachable, incl. mobile) */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex rounded-xl border border-line bg-white p-1">
              {(['overview', 'review'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors sm:px-3.5 ${
                    view === v ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {v === 'overview' ? 'Overview' : 'Review'}
                </button>
              ))}
            </div>
            <span className="tnum hidden shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand sm:inline-block">
              {review.rawScore}/{review.total}
              {band ? ` · ${band.label}` : ` · ${accuracy}%`}
            </span>
          </div>
        </div>
      </header>

      {view === 'overview' ? (
        <OverviewView
          review={review}
          parts={parts}
          resultById={resultById}
          numberById={numberById}
          onOpenReview={(pi) => {
            setPartIndex(pi)
            setView('review')
          }}
        />
      ) : (
        <ReviewView
          parts={parts}
          resultById={resultById}
          numberById={numberById}
          partIndex={partIndex}
          setPartIndex={setPartIndex}
        />
      )}
    </FullScreen>
  )
}

// ---- Overview: band + score + per-part answer key ---------------------------

function OverviewView({
  review,
  parts,
  resultById,
  numberById,
  onOpenReview,
}: {
  review: AttemptReview
  parts: Part[]
  resultById: Map<string, ItemResult>
  numberById: Map<string, number>
  onOpenReview: (partIndex: number) => void
}) {
  const band = review.band ? BAND_INFO[review.band] : null
  const accuracy = review.total > 0 ? Math.round((review.rawScore / review.total) * 100) : 0
  const shownScore = useCountUp(review.rawScore)
  const goodBand = review.band === 'B2' || review.band === 'C1' || (!band && accuracy >= 70)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-8">
        {/* Score header */}
        <section className="relative overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-soft blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
                {band ? 'Indicative reading band' : 'Part practice'}
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-4xl font-extrabold text-heading sm:text-5xl">
                  {band ? band.label : `${accuracy}%`}
                </span>
                <p className="tnum text-2xl font-extrabold text-heading">
                  {shownScore} / {review.total} correct
                </p>
              </div>
              {band && (
                <div className="mt-6">
                  <BandRuler band={review.band!} score={review.rawScore} animate />
                </div>
              )}
            </div>
            <div className="mx-auto flex shrink-0 flex-col items-center">
              <div className="relative max-w-56 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-bold text-brand-deep">
                {band ? band.blurb : accuracy >= 70 ? 'Sharp work — check the few you missed below.' : 'Every drill counts — the evidence is highlighted right in the text.'}
                <span
                  className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-brand-soft"
                  aria-hidden
                />
              </div>
              <img
                src="/cat-read-grey.png"
                alt=""
                aria-hidden
                draggable={false}
                width={128}
                height={140}
                className={`mt-3 block h-[140px] w-auto select-none ${goodBand ? 'cat-bob' : ''}`}
              />
            </div>
          </div>
        </section>

        {/* Answer key */}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-heading">Answer key</h2>
            <button
              onClick={() => onOpenReview(0)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-deep"
            >
              Review &amp; explanations
              <ArrowRightIcon width={16} height={16} />
            </button>
          </div>
          <div className="space-y-6">
            {parts.map((part, pi) => {
              const items = part.items
              const correctCount = items.filter((it) => resultById.get(it.id)?.correct).length
              return (
                <div key={part.id}>
                  <button
                    onClick={() => onOpenReview(pi)}
                    className="group mb-3 flex items-center gap-2 text-left"
                  >
                    <h3 className="font-extrabold text-heading">Part {part.number}</h3>
                    <span className="tnum text-sm font-semibold text-ink-soft">
                      {correctCount}/{items.length} correct
                    </span>
                    <ArrowRightIcon
                      width={16}
                      height={16}
                      className="text-ink-faint transition-colors group-hover:text-brand"
                    />
                  </button>
                  <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                    {items.map((item) => (
                      <AnswerKeyRow
                        key={item.id}
                        item={item}
                        res={resultById.get(item.id)}
                        n={numberById.get(item.id)!}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function AnswerKeyRow({ item, res, n }: { item: Item; res?: ItemResult; n: number }) {
  const correct = !!res?.correct
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="q-badge shrink-0">{n}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-bold text-ink">{shortCorrect(item)}</span>
        <span className="text-ink-faint"> : </span>
        <span className={correct ? 'text-ink-soft' : 'font-semibold text-rose-600'}>
          {shortUser(item, res)}
        </span>
      </span>
      {correct ? (
        <span className="shrink-0 text-emerald-600" aria-label="correct">
          ✓
        </span>
      ) : (
        <span className="shrink-0 text-rose-500" aria-label="incorrect">
          ✗
        </span>
      )}
    </div>
  )
}

// ---- Review: split view — questions | passage with Qn highlights ------------

function ReviewView({
  parts,
  resultById,
  numberById,
  partIndex,
  setPartIndex,
}: {
  parts: Part[]
  resultById: Map<string, ItemResult>
  numberById: Map<string, number>
  partIndex: number
  setPartIndex: (i: number) => void
}) {
  const [leftPct, setLeftPct] = useState(46)
  const [focusedN, setFocusedN] = useState<number | null>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const part = parts[partIndex]

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const container = paneRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const onMove = (e: PointerEvent) => {
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setLeftPct(Math.min(65, Math.max(32, pct)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function locate(n: number) {
    setFocusedN(n)
    setTimeout(() => {
      document.getElementById(`hl-q${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 40)
  }

  return (
    <>
      <div
        ref={paneRef}
        className="flex min-h-0 flex-1 flex-col lg:flex-row"
        style={{ ['--an-left' as never]: `${leftPct}%` }}
      >
        {/* Left: questions + the student's answers */}
        <div className="min-w-0 space-y-4 overflow-y-auto p-4 sm:p-6 lg:w-[var(--an-left)]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
              Part {part.number} · Questions
            </p>
            <p className="mt-1 text-sm text-ink-soft">{part.instructions}</p>
          </div>
          {part.items.map((item) => (
            <QuestionCard
              key={item.id}
              item={item}
              res={resultById.get(item.id)}
              n={numberById.get(item.id)!}
              onLocate={locate}
            />
          ))}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize"
          onPointerDown={startDrag}
          className="hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-line transition-colors hover:bg-brand lg:block"
        />

        {/* Right: the reading material with answer locations highlighted */}
        <div className="min-w-0 flex-1 overflow-y-auto border-t border-line bg-white p-4 sm:p-6 lg:border-t-0">
          <PassagePane part={part} resultById={resultById} numberById={numberById} focusedN={focusedN} />
        </div>
      </div>

      {/* Bottom part tabs */}
      <footer className="shrink-0 border-t border-line bg-white px-4 py-2.5 sm:px-6">
        <nav
          className="mx-auto flex w-fit max-w-full overflow-x-auto whitespace-nowrap rounded-xl border border-line bg-white p-1"
          aria-label="Parts"
        >
          {parts.map((p, index) => {
            const items = p.items
            const correctCount = items.filter((it) => resultById.get(it.id)?.correct).length
            return (
              <button
                key={p.id}
                onClick={() => {
                  setPartIndex(index)
                  setFocusedN(null)
                }}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                  index === partIndex ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
                }`}
              >
                Part {p.number}
                <span className={`tnum ml-1.5 text-xs ${index === partIndex ? 'text-white/80' : ''}`}>
                  {correctCount}/{items.length}
                </span>
              </button>
            )
          })}
        </nav>
      </footer>
    </>
  )
}

function QuestionCard({
  item,
  res,
  n,
  onLocate,
}: {
  item: Item
  res?: ItemResult
  n: number
  onLocate: (n: number) => void
}) {
  const [showExplain, setShowExplain] = useState(false)
  const correct = !!res?.correct
  const prompt = item.type === 'gap' ? 'Gap — one word from the text' : (item.prompt ?? '')

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <div className="mb-2 flex items-start gap-2.5">
        <span className="q-badge shrink-0">{n}</span>
        {/* Part 2 texts are long and also shown (highlighted) on the right, so
            clamp them here; short prompts (headings, MCQ, gap) show in full. */}
        <p className={`min-w-0 flex-1 text-sm font-semibold text-ink ${item.type === 'match' ? 'line-clamp-3' : ''}`}>
          {prompt}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {correct ? 'Correct' : 'Incorrect'}
        </span>
      </div>

      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-ink-soft">Correct:</dt>
          <dd className="font-bold text-emerald-700">{res?.correctAnswerLabel ?? shortCorrect(item)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-ink-soft">You:</dt>
          <dd className={res?.userAnswerLabel ? (correct ? 'font-semibold text-ink' : 'font-semibold text-rose-600') : 'italic text-ink-soft'}>
            {res?.userAnswerLabel ?? 'No answer'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onLocate(n)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:border-brand hover:text-brand"
        >
          <BookIcon width={14} height={14} />
          Locate
        </button>
        <button
          onClick={() => setShowExplain((s) => !s)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
            showExplain ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-white text-ink hover:border-brand hover:text-brand'
          }`}
        >
          Explain
        </button>
        <a
          href={COMMUNITY_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft transition-colors hover:border-ink-faint hover:text-ink"
        >
          <FlagIcon width={14} height={14} />
          Report
        </a>
      </div>

      {showExplain && (
        <div className="mt-3 space-y-1 rounded-xl bg-page p-3 text-sm text-ink">
          <p>
            <span className="font-semibold">Where: </span>
            {item.explanation.location}
          </p>
          <p className="italic text-ink-soft">“{item.explanation.quote}”</p>
          <p>{item.explanation.reasoning}</p>
        </div>
      )}
    </div>
  )
}

// The right pane: renders the reading material per layout, with every answer
// location highlighted and stamped Qn.
function PassagePane({
  part,
  resultById,
  numberById,
  focusedN,
}: {
  part: Part
  resultById: Map<string, ItemResult>
  numberById: Map<string, number>
  focusedN: number | null
}) {
  const quoteFor = (item: Item): QuoteHighlight => ({
    n: numberById.get(item.id)!,
    quote: item.explanation.quote,
    location: item.explanation.location,
    correct: !!resultById.get(item.id)?.correct,
  })

  // Part 3 — headings: each paragraph is one question; highlight its quote.
  if (part.layout === 'match_headings') {
    const paragraphs = part.passage?.paragraphs ?? []
    const items = part.items
    return (
      <div className="space-y-4">
        {part.passage?.title && (
          <h3 className="text-base font-extrabold text-heading">{part.passage.title}</h3>
        )}
        {paragraphs.map((para, i) => {
          const item = items[i]
          return (
            <div key={para.label}>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                Paragraph {para.label}
              </p>
              <div className="passage">
                <p>
                  <HighlightedText text={htmlToText(para.html)} quotes={item ? [quoteFor(item)] : []} focusedN={focusedN} />
                </p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Part 2 — matching texts: no shared passage; each text is its own block.
  if (part.layout === 'match_texts') {
    return (
      <div className="space-y-4">
        {part.items.map((item) => (
          <div key={item.id}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
              Text {numberById.get(item.id)!}
            </p>
            <div className="passage">
              <p>
                <HighlightedText text={item.type === 'match' ? item.prompt : ''} quotes={[quoteFor(item)]} focusedN={focusedN} />
              </p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Parts 1, 4, 5 — a shared passage with {{gaps}} and/or quote evidence.
  const gaps: Record<string, GapFill> = {}
  const quotes: QuoteHighlight[] = []
  for (const item of part.items) {
    const n = numberById.get(item.id)!
    const correct = !!resultById.get(item.id)?.correct
    if (item.type === 'gap') {
      gaps[item.id] = { n, answer: item.answer[0] ?? '', correct }
    } else {
      quotes.push({ n, quote: item.explanation.quote, location: item.explanation.location, correct })
    }
  }
  return (
    <div>
      {part.passage?.title && (
        <h3 className="mb-3 text-base font-extrabold text-heading">{part.passage.title}</h3>
      )}
      <div className="passage">
        <HighlightedPassage html={part.passage?.html ?? ''} gaps={gaps} quotes={quotes} focusedN={focusedN} />
      </div>
    </div>
  )
}

// ---- helpers ----------------------------------------------------------------

function htmlToText(html: string): string {
  return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
}

function shortCorrect(item: Item): string {
  switch (item.type) {
    case 'gap':
      return item.answer.join(' / ')
    case 'match':
    case 'mcq':
      return item.answer
    case 'tfng':
      return item.answer === 'true' ? 'TRUE' : item.answer === 'false' ? 'FALSE' : item.thirdOptionLabel
  }
}

function shortUser(item: Item, res?: ItemResult): string {
  if (!res || res.userAnswer == null) return '—'
  switch (item.type) {
    case 'gap':
    case 'match':
    case 'mcq':
      return res.userAnswer
    case 'tfng':
      return res.userAnswer === 'true' ? 'TRUE' : res.userAnswer === 'false' ? 'FALSE' : item.thirdOptionLabel
  }
}
