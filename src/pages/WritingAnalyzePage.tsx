import { Suspense, lazy, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BandRuler } from '../components/BandRuler'
import { Skeleton } from '../components/Skeleton'
import { CheckIcon, CloseIcon, PenIcon } from '../components/icons'
import { SendingCat } from '../components/speaking/SendingCat'
import { BAND_INFO } from '../lib/bands'
import { fetchWritingAttempt, retryWritingAttempt } from '../lib/writingGrading'
import {
  CORRECTION_LABEL,
  CRITERION_BLURB,
  CRITERION_LABEL,
  WRITING_CRITERIA,
  ZERO_LABEL,
  type GradedWritingTask,
  type WritingAttemptRow,
  type WritingCorrection,
} from '../types/writingResult'

// ---------------------------------------------------------------------------
// The writing report.
//
// The thing being marked is still on the page — unlike a speaking attempt,
// whose audio is deleted the moment it is graded. So the centre of this screen
// is the student's own script with the corrections marked ON it, and everything
// else (the bands, the criteria, the improved version) hangs off that. Reading
// a list of faults you then have to find in your own essay is not feedback.
// ---------------------------------------------------------------------------

export function WritingAnalyzePage() {
  const { attemptId } = useParams()

  // DEV ONLY — /writing/analyze/preview renders a sample marked paper so the
  // report can be reviewed without a deployed grader. Its numbers come from
  // running the real scoring code (see src/lib/writingPreview.ts), so what is
  // on screen is what the grader computes. Same spirit as /?band= and
  // /login?cat=; remove it before launch, like /cat-preview.
  const isPreview = attemptId === 'preview'
  const [params] = useSearchParams()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['writing-attempt', attemptId],
    queryFn: () => fetchWritingAttempt(attemptId!),
    enabled: !!attemptId && !isPreview,
    // Marking takes a few seconds; keep looking until it lands.
    refetchInterval: (q) => (q.state.data?.status === 'grading' ? 3000 : false),
  })

  if (isPreview) {
    const key = params.get('case') ?? 'full'
    return (
      <>
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-bold">
            Preview — a sample marked paper, scored by the real grading code. No student wrote this.
          </p>
          <p className="mt-1">
            {(
              [
                ['full', 'Full paper'],
                ['short', 'Half-finished essay (length cap)'],
                ['drill', 'One task only (estimate)'],
              ] as const
            ).map(([k, label], i) => (
              <span key={k}>
                {i > 0 && ' · '}
                <Link
                  to={`/writing/analyze/preview?case=${k}`}
                  className={key === k ? 'font-extrabold underline' : 'font-bold hover:underline'}
                >
                  {label}
                </Link>
              </span>
            ))}
          </p>
        </div>
        <Suspense fallback={<LoadingState />}>
          <PreviewReport caseKey={key} />
        </Suspense>
      </>
    )
  }
  if (isLoading) return <LoadingState />
  if (error) return <Notice title="Could not load this report" body={(error as Error).message} />
  if (!data) {
    return (
      <Notice
        title="Report not found"
        body="This attempt does not exist, or it belongs to another account."
      />
    )
  }
  if (data.status === 'grading') return <GradingState />
  if (data.status === 'failed' || !data.result) {
    return <FailedState attempt={data} onRetried={() => void refetch()} />
  }

  return <Report attempt={data} />
}

/** The sample papers are loaded ONLY when the preview route is opened, so the
 *  fixture (~22 KB of marked-up essays) never ships to a student reading their
 *  own report. DEV ONLY — remove with the route before launch. */
const PreviewReport = lazy(async () => {
  const { WRITING_PREVIEWS } = await import('../lib/writingPreview')
  return {
    default: ({ caseKey }: { caseKey: string }) => (
      <Report attempt={WRITING_PREVIEWS[caseKey] ?? WRITING_PREVIEWS.full} />
    ),
  }
})

function Report({ attempt }: { attempt: WritingAttemptRow }) {
  const result = attempt.result!
  const isDrill = attempt.scope === 'part'
  const rating = attempt.rating ?? 0
  // A drill fills one task only, so its band is an extrapolation rather than a
  // mark. The row stores band NULL for exactly that reason; it is recomputed
  // here for display and labelled as an estimate.
  const band = attempt.band ?? result.band

  const textFor = (taskId: string) =>
    attempt.answers?.find((a) => a.taskId === taskId)?.text ?? ''

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              Writing · {isDrill ? 'Task practice' : 'Full paper'}
            </p>
            <h1 className="mt-1 truncate text-2xl font-extrabold text-heading">
              {attempt.test_title}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {new Date(attempt.created_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <p className="tnum text-4xl font-extrabold text-heading">
              {rating}
              <span className="text-lg text-ink-soft">/75</span>
            </p>
            <span className="mt-1 inline-block rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand">
              {BAND_INFO[band].label}
            </span>
          </div>
        </div>

        {isDrill ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p>
              This is an <strong>estimate</strong> from one task only. The real paper has three,
              so this score is not saved to your results history.
            </p>
            <p className="mt-2">
              It answers one question: <strong>if you wrote at this level across the whole
              paper</strong>, this is where you would land.
            </p>
          </div>
        ) : (
          <div className="mt-5">
            <BandRuler band={band} score={ratingToRulerScore(rating)} animate />
          </div>
        )}

        {!isDrill && (
          <p className="tnum mt-4 text-sm text-ink-soft">
            Raw score <strong className="text-ink">{result.raw36}</strong> / {result.maxRaw}, converted
            to {rating}/75 by the official table.
          </p>
        )}

        {result.summary && <p className="mt-4 text-[15px] leading-relaxed text-ink">{result.summary}</p>}

        {result.fixFirst && (
          <div className="mt-4 rounded-xl bg-brand-soft px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand">Fix this first</p>
            <p className="mt-1 text-sm font-semibold text-ink">{result.fixFirst}</p>
          </div>
        )}
      </section>

      {result.tasks.map((task) => (
        <TaskReport key={task.taskId} task={task} text={textFor(task.taskId)} />
      ))}

      <p className="text-center text-xs text-ink-soft">
        Marked against the official Multilevel writing criteria. Bands are produced by an AI
        examiner and are indicative — an official result comes from the exam itself.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One task.
// ---------------------------------------------------------------------------

function TaskReport({ task, text }: { task: GradedWritingTask; text: string }) {
  const [view, setView] = useState<'feedback' | 'original'>('feedback')
  const marked = task.corrections.filter((c) => c.start >= 0)
  const unlocated = task.corrections.filter((c) => c.start < 0)

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <PenIcon width={20} height={20} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-heading">{task.taskLabel}</h2>
            <p className="tnum text-xs font-semibold text-ink-soft">
              {task.wordCount} words · asked for about {task.targetWords}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="tnum text-2xl font-extrabold text-heading">
            {task.band}
            <span className="text-sm text-ink-soft">/9</span>
          </p>
          <p className="tnum text-xs font-semibold text-ink-soft">
            {round1(task.points)} of {task.weight} marks
          </p>
        </div>
      </div>

      {task.zeroMark && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {ZERO_LABEL[task.zeroMark]} Under the official rules this task scores 0.
        </p>
      )}

      {task.underlengthCapped && !task.zeroMark && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The writing itself was worth <strong>band {task.bandBeforeCap}</strong>, but at{' '}
          {task.wordCount} words it is too short for the task and the official length rules cap it
          at <strong>band {task.band}</strong>. Length costs marks before quality is even weighed.
        </p>
      )}

      {task.comment && <p className="mt-4 text-[15px] leading-relaxed text-ink">{task.comment}</p>}

      {/* The four official criteria. */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {WRITING_CRITERIA.map((c) => (
          <div key={c} className="rounded-xl border border-line bg-page px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-ink">{CRITERION_LABEL[c]}</p>
              <p className="tnum text-sm font-extrabold text-heading">
                {task.criteria[c]}
                <span className="text-xs text-ink-soft">/9</span>
              </p>
            </div>
            <BandBar value={task.criteria[c]} />
            <p className="mt-1.5 text-xs text-ink-soft">{CRITERION_BLURB[c]}</p>
          </div>
        ))}
      </div>

      {task.inferredCriteria.length > 0 && (
        <p className="mt-3 text-xs text-ink-soft">
          The examiner did not return a separate mark for{' '}
          {task.inferredCriteria.map((c) => CRITERION_LABEL[c].toLowerCase()).join(', ')} — those are
          shown at the average of the rest rather than as a zero.
        </p>
      )}

      {task.contentPoints.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-extrabold text-heading">What the task asked for</h3>
          <ul className="mt-2 space-y-1.5">
            {task.contentPoints.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink">
                <span
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${
                    p.covered ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {p.covered ? <CheckIcon width={10} height={10} /> : <CloseIcon width={10} height={10} />}
                </span>
                <span className={p.covered ? '' : 'text-ink-soft'}>{p.point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The script itself. */}
      {text.trim() && (
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-heading">What you wrote</h3>
            <div className="flex gap-1 rounded-xl border border-line bg-white p-1">
              {(['feedback', 'original'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                    view === v ? 'bg-brand text-white' : 'text-ink hover:text-brand'
                  }`}
                >
                  {v === 'feedback' ? `Feedback (${marked.length})` : 'Original'}
                </button>
              ))}
            </div>
          </div>
          <div className="passage rounded-xl border border-line bg-page px-4 py-3 text-[15px] leading-[1.9] whitespace-pre-wrap text-ink">
            {view === 'feedback' && marked.length > 0 ? (
              <MarkedText text={text} corrections={marked} />
            ) : (
              text
            )}
          </div>
          {view === 'feedback' && marked.length === 0 && (
            <p className="mt-2 text-xs text-ink-soft">
              Nothing was marked for correction in this task.
            </p>
          )}
        </div>
      )}

      {unlocated.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-extrabold text-heading">Also worth fixing</h3>
          <ul className="mt-2 space-y-2">
            {unlocated.map((c, i) => (
              <li key={i} className="rounded-xl border border-line bg-page px-4 py-3 text-sm">
                <span className="text-ink-soft line-through">{c.quote}</span>{' '}
                <span className="font-bold text-emerald-800">{c.suggestion}</span>
                {c.note && <p className="mt-1 text-xs text-ink-soft">{c.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {task.strengths.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-extrabold text-heading">Keep doing this</h3>
          <ul className="mt-2 space-y-2">
            {task.strengths.map((s, i) => (
              <li key={i} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-800">“{s.quote}”</p>
                <p className="mt-1 text-xs text-emerald-800/80">{s.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {task.improved && !task.zeroMark && (
        <div className="mt-5">
          <h3 className="text-sm font-extrabold text-heading">Your answer, one band higher</h3>
          <p className="mt-1 text-xs text-ink-soft">
            Your own ideas, rewritten. Read it beside your version above — the difference is the
            marks.
          </p>
          <div className="passage mt-2 rounded-xl border border-brand-soft bg-brand-soft/40 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
            {task.improved}
          </div>
        </div>
      )}

      {task.evidence && (
        <details className="mt-5 rounded-xl border border-line bg-page px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold text-ink">
            Why these bands?
          </summary>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{task.evidence}</p>
        </details>
      )}
    </section>
  )
}

/** The student's text with each correction marked in place. Offsets come from
 *  the server, which located every quote inside this exact string — so the
 *  slicing here cannot drift from what was marked. */
function MarkedText({ text, corrections }: { text: string; corrections: WritingCorrection[] }) {
  const out: ReactNode[] = []
  let cursor = 0

  corrections
    .slice()
    .sort((a, b) => a.start - b.start)
    .forEach((c, i) => {
      if (c.start < cursor) return // defensive: overlaps are dropped server-side
      if (c.start > cursor) out.push(text.slice(cursor, c.start))
      out.push(
        <span key={i} className="group relative inline">
          <mark className="rounded bg-rose-100 px-0.5 text-rose-900 decoration-rose-400 underline decoration-wavy underline-offset-4">
            {text.slice(c.start, c.end)}
          </mark>
          <span className="ml-1 inline-flex items-baseline gap-1 rounded bg-emerald-50 px-1.5 py-0.5 align-baseline text-[13px] font-bold text-emerald-800">
            {c.suggestion}
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/70">
              {CORRECTION_LABEL[c.type]}
            </span>
          </span>
          {c.note && <span className="ml-1 text-[13px] text-ink-soft">({c.note})</span>}
        </span>,
      )
      cursor = c.end
    })

  if (cursor < text.length) out.push(text.slice(cursor))
  return <>{out}</>
}

function BandBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, (value / 9) * 100))
  const tone = value >= 7 ? 'bg-emerald-500' : value >= 5 ? 'bg-brand' : 'bg-amber-500'
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// States.
// ---------------------------------------------------------------------------

function GradingState() {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-extrabold text-heading">Marking your writing</h1>
      <SendingCat
        title="The examiner is reading"
        lines={[
          'Reading what you wrote, sentence by sentence…',
          'Checking it against the official criteria…',
          'Marking grammar, vocabulary and how your ideas link…',
          'Almost there — writing your feedback…',
        ]}
        note="This usually takes under a minute. You can leave this page; your report will be waiting in My results."
      />
    </div>
  )
}

function FailedState({
  attempt,
  onRetried,
}: {
  attempt: WritingAttemptRow
  onRetried: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const retry = async () => {
    setBusy(true)
    setError(null)
    try {
      await retryWritingAttempt(attempt.id)
      onRetried()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-extrabold text-heading">This check did not finish</h1>
      <p className="text-sm text-ink-soft">
        {attempt.error_message ?? 'The AI examiner could not be reached.'}
      </p>
      {/* The reassurance that matters: unlike a speaking attempt, nothing was
          lost — the text is on the server and can be marked again at any time. */}
      <p className="text-sm text-ink">
        <strong>Your writing is safe.</strong> Everything you wrote is saved, so this can be marked
        again — a failed check costs you nothing from your monthly allowance.
      </p>
      {error && <p className="text-sm font-semibold text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={retry}
          disabled={busy}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Check again'}
        </button>
        <Link
          to="/writing"
          className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
        >
          Back to Writing
        </Link>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-8 w-2/3" />
        <Skeleton className="mt-5 h-16 w-full" />
      </div>
      <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-32 w-full" />
      </div>
    </div>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-extrabold text-heading">{title}</h1>
      <p className="text-sm text-ink-soft">{body}</p>
      <Link to="/writing" className="inline-block font-bold text-brand hover:underline">
        Back to Writing
      </Link>
    </div>
  )
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** The ruler is drawn on the /35 reading scale, so a /75 writing rating is
 *  mapped onto the equivalent point of it. Same trick the speaking report uses:
 *  the band boundaries line up (38/51/65 of 75 ≈ 10/18/28 of 35). */
function ratingToRulerScore(rating: number): number {
  if (rating >= 65) return 28 + ((rating - 65) / 10) * 7
  if (rating >= 51) return 18 + ((rating - 51) / 14) * 10
  if (rating >= 38) return 10 + ((rating - 38) / 13) * 8
  return (rating / 38) * 10
}
