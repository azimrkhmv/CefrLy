import { Fragment, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BandRuler } from '../components/BandRuler'
import { Skeleton } from '../components/Skeleton'
import { CheckIcon, MicIcon } from '../components/icons'
import { SendingCat } from '../components/speaking/SendingCat'
import {
  fetchRecheck,
  fetchSpeakingAttempt,
  requestRecheck,
  retrySpeakingAttempt,
} from '../lib/speakingGrading'
import { BAND_INFO } from '../lib/bands'
import {
  ERROR_LABEL,
  type GradedAnswer,
  type SpeakingAttemptRow,
  type SpeakingResult,
} from '../types/speakingResult'

// ---------------------------------------------------------------------------
// The speaking analysis. There is no audio here and there never will be — the
// recordings were deleted the moment grading finished, so the TRANSCRIPT is the
// record of what the student said. Everything else hangs off it: mistakes are
// highlighted in place, the good phrases beside them, and the improved version
// sits next to the original so the difference is visible rather than described.
// ---------------------------------------------------------------------------

export function SpeakingAnalyzePage() {
  const { attemptId } = useParams()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['speaking-attempt', attemptId],
    queryFn: () => fetchSpeakingAttempt(attemptId!),
    enabled: !!attemptId,
    // Grading takes a few seconds; keep looking until it lands.
    refetchInterval: (q) => (q.state.data?.status === 'grading' ? 3000 : false),
  })

  if (isLoading) return <LoadingState />
  if (error) return <Notice title="Could not load this analysis" body={(error as Error).message} />
  if (!data) return <Notice title="Analysis not found" body="This attempt does not exist, or it belongs to another account." />
  if (data.status === 'grading') return <GradingState />
  if (data.status === 'failed' || !data.result) {
    return <FailedState attempt={data} onRetried={() => void refetch()} />
  }

  return <Analysis attempt={data} />
}

function Analysis({ attempt }: { attempt: SpeakingAttemptRow }) {
  const result = attempt.result!
  const isDrill = attempt.scope === 'part'
  const rating = attempt.rating ?? 0
  // A drill fills one block only, so its band is scaled, not earned. The row
  // stores band NULL for exactly that reason; we recompute it for display and
  // label it as an estimate.
  const band = attempt.band ?? bandFromRating(rating)

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              Speaking · {isDrill ? 'Part practice' : 'Full mock'}
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
              This is an <strong>estimate</strong> from one part only. A real CEFR band needs all
              four parts, so this score is not saved to your results history.
            </p>
            {/* Where the number came from. A block mark is bounded by its task
                (Part 1.1 is worth 5), so the /75 is read off HOW THE STUDENT
                SPOKE instead — otherwise a B2 speaker on an easy part gets told
                they are B1. */}
            {result.estimateBasis === 'criteria' ? (
              <p className="mt-2">
                This score is placed on the 75-point scale from{' '}
                <strong>how you spoke</strong> — your grammar, vocabulary, pronunciation, fluency
                and linking of ideas — less anything you did not answer. The full paper is what
                settles a real band.
              </p>
            ) : (
              result.capBand && (
                <p className="mt-2">
                  Graded before we improved this: {blockLabel(result)} estimates were capped at{' '}
                  <strong>{BAND_INFO[result.capBand].label}</strong> back then. A new attempt is
                  scored from how you speak.
                </p>
              )
            )}
          </div>
        ) : (
          <div className="mt-5">
            <BandRuler band={band} score={ratingToRulerScore(rating)} animate />
          </div>
        )}

        {/* The paper's OWN total, not the sum of the blocks that came back: a
            student who skipped a whole part must not see a smaller denominator
            that makes the score look better than it is. */}
        <p className="tnum mt-4 text-sm text-ink-soft">
          Raw score {attempt.raw_score} of{' '}
          {result.maxRaw ?? result.blocks.reduce((n, b) => n + b.max, 0)}
        </p>
      </section>

      {result.fixFirst && (
        <section className="rounded-2xl bg-sun-soft p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-sun-ink">Fix this first</p>
          <p className="mt-1.5 font-bold text-heading">{result.fixFirst}</p>
        </section>
      )}

      {/* A drill fills exactly one block, so its card just repeats the header's
          score and the Overall text. Only a full mock has a breakdown worth
          showing. */}
      {!isDrill && (
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {result.blocks.map((b) => (
          <div key={b.key} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-soft">{b.label}</p>
            <p className="tnum mt-1 text-2xl font-extrabold text-heading">
              {b.score}
              <span className="text-base text-ink-soft">/{b.max}</span>
            </p>
            {b.questionCount !== undefined && b.onTopicCount !== undefined && (
              <p className="tnum mt-0.5 text-xs text-ink-soft">
                {b.onTopicCount} of {b.questionCount} answered on topic
              </p>
            )}
            {b.coverage === 'partial' && (
              <p className="mt-0.5 text-xs text-ink-soft">Task covered only in part</p>
            )}
            {b.key === 'q8' && b.balanced === false && (
              <p className="mt-0.5 text-xs text-ink-soft">Argued one side only</p>
            )}
            {b.reason && <p className="mt-2 text-sm text-ink-soft">{b.reason}</p>}
          </div>
        ))}
      </section>
      )}

      {/* The judgement every mark on this page was computed from. It is ONE view
          of the speaker, not one per task, and it comes with the quotes behind
          it — a band you can check beats a band you must accept. */}
      {result.profile?.criteria && (
        <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
          <h2 className="font-extrabold text-heading">Your English, criterion by criterion</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Every mark below was worked out from these five judgements.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {(
              [
                ['grammar', 'Grammar'],
                ['vocabulary', 'Vocabulary'],
                ['pronunciation', 'Pronunciation'],
                ['fluency', 'Fluency'],
                ['coherence', 'Linking ideas'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="rounded-xl border border-line bg-page px-4 py-3">
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">{label}</dt>
                <dd className="mt-1 text-lg font-extrabold text-brand">
                  {result.profile!.criteria[key].replace('below_A2', 'below A2')}
                </dd>
              </div>
            ))}
          </dl>
          {result.profile.evidence && (
            <p className="mt-4 rounded-xl bg-brand-soft px-4 py-3 text-sm text-ink">
              <strong className="font-bold">Why: </strong>
              {result.profile.evidence}
            </p>
          )}
        </section>
      )}

      {result.summary && (
        <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
          <h2 className="font-extrabold text-heading">Overall</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink">{result.summary}</p>
        </section>
      )}

      <div className="space-y-5">
        <h2 className="text-lg font-extrabold text-heading">Your answers</h2>
        {result.answers.map((a, i) => (
          <AnswerCard key={a.questionIndex} n={i + 1} answer={a} />
        ))}
      </div>

      <RecheckBox attemptId={attempt.id} />

      <div className="flex flex-wrap gap-3">
        <Link
          to="/speaking"
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          Practise again
        </Link>
        <Link
          to="/samples"
          className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
        >
          See model answers
        </Link>
      </div>
    </div>
  )
}

function AnswerCard({ n, answer }: { n: number; answer: GradedAnswer }) {
  const spoke = answer.transcript.trim().length > 0
  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tnum font-extrabold text-brand">Q{n}</span>
        <p className="min-w-0 flex-1 font-bold text-ink">{answer.questionText}</p>
      </div>

      <div className="tnum mt-3 flex flex-wrap gap-2 text-xs">
        <Stat label="spoke" value={`${Math.round(answer.durationSec)}s`} />
        <Stat label="speed" value={`${answer.wordsPerMinute} wpm`} />
        <Stat label="fillers" value={String(answer.fillerCount)} />
      </div>

      {!spoke ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Nothing was recorded for this question.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
              What you said
            </h3>
            <p className="mt-2 leading-loose text-ink">
              <Marked
                text={answer.transcript}
                errors={answer.errors.map((e) => e.quote)}
                strengths={answer.strengths.map((s) => s.quote)}
              />
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              <span className="rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-800">
                mistake
              </span>{' '}
              <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-800">
                good phrase
              </span>
            </p>
          </div>

          {answer.errors.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Mistakes ({answer.errors.length})
              </h3>
              <ul className="mt-2 space-y-2">
                {answer.errors.map((e, i) => (
                  <li
                    key={`${e.quote}-${i}`}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm"
                  >
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-rose-800">
                      {ERROR_LABEL[e.type] ?? e.type}
                    </span>
                    <p className="mt-1.5 text-rose-900 line-through decoration-rose-400">
                      {e.quote}
                    </p>
                    <p className="mt-1 font-bold text-ink">{e.fix}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {answer.strengths.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                Good language you used
              </h3>
              <ul className="mt-2 space-y-2">
                {answer.strengths.map((s, i) => (
                  <li
                    key={`${s.quote}-${i}`}
                    className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm"
                  >
                    <CheckIcon width={16} height={16} />
                    <span>
                      <strong className="font-bold text-emerald-900">{s.quote}</strong>
                      <span className="text-emerald-900"> — {s.why}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel title="Pronunciation">{answer.pronunciation}</Panel>
            <Panel title="Fluency">{answer.fluency}</Panel>
          </div>

          {answer.improved && (
            <div className="mt-5 rounded-2xl bg-brand-soft p-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-brand">
                A stronger version of your answer
              </h3>
              <p className="mt-2 leading-relaxed text-ink">{answer.improved}</p>
              <p className="mt-2 text-xs text-ink-soft">
                Written one level above what you said — close enough to copy next time.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/** Highlight the quoted mistakes and strong phrases inside the transcript.
 *  Quotes come back from the model as exact substrings; any that no longer
 *  match (a paraphrase slipped through) is simply skipped rather than
 *  mangling the text. */
function Marked({
  text,
  errors,
  strengths,
}: {
  text: string
  errors: string[]
  strengths: string[]
}): ReactNode {
  type Span = { start: number; end: number; kind: 'error' | 'strength' }
  const spans: Span[] = []

  const add = (quote: string, kind: Span['kind']) => {
    const q = quote.trim()
    if (q.length < 2) return
    const at = text.toLowerCase().indexOf(q.toLowerCase())
    if (at === -1) return
    spans.push({ start: at, end: at + q.length, kind })
  }
  errors.forEach((q) => add(q, 'error'))
  strengths.forEach((q) => add(q, 'strength'))

  spans.sort((a, b) => a.start - b.start)
  const out: ReactNode[] = []
  let cursor = 0
  spans.forEach((s, i) => {
    if (s.start < cursor) return // overlapping quotes: keep the first
    if (s.start > cursor) out.push(<Fragment key={`t${i}`}>{text.slice(cursor, s.start)}</Fragment>)
    out.push(
      <mark
        key={`m${i}`}
        className={
          s.kind === 'error'
            ? 'rounded bg-rose-100 px-0.5 font-bold text-rose-900'
            : 'rounded bg-emerald-100 px-0.5 font-bold text-emerald-900'
        }
      >
        {text.slice(s.start, s.end)}
      </mark>,
    )
    cursor = s.end
  })
  if (cursor < text.length) out.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>)
  return <>{out}</>
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <span className="rounded-full bg-page px-3 py-1 font-bold text-ink-soft">
    {value} <span className="font-normal">{label}</span>
  </span>
)

const Panel = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-xl border border-line bg-page px-4 py-3">
    <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">{title}</h3>
    <p className="mt-1 text-sm text-ink">{children}</p>
  </div>
)

/** "Part 1.1" etc — the drill's one block, for the ceiling note. */
const blockLabel = (result: SpeakingResult) => result.blocks[0]?.label ?? 'This part'

/** The ruler works in exam marks, not rating points; map 0-75 onto its scale. */
function ratingToRulerScore(rating: number): number {
  if (rating >= 65) return 28 + Math.round(((rating - 65) / 10) * 7)
  if (rating >= 50) return 18 + Math.round(((rating - 50) / 15) * 10)
  if (rating >= 38) return 10 + Math.round(((rating - 38) / 12) * 8)
  return Math.round((rating / 38) * 9)
}

function bandFromRating(rating: number) {
  if (rating >= 65) return 'C1' as const
  if (rating >= 50) return 'B2' as const
  if (rating >= 38) return 'B1' as const
  return 'below_B1' as const
}

const LoadingState = () => (
  <div className="space-y-4">
    <Skeleton className="h-40 rounded-2xl" />
    <Skeleton className="h-24 rounded-2xl" />
    <Skeleton className="h-64 rounded-2xl" />
  </div>
)

const GradingState = () => (
  <div className="rounded-2xl border border-line bg-white p-6 text-center shadow-card sm:p-8">
    <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
      <MicIcon width={24} height={24} />
    </span>
    <h1 className="mt-3 text-xl font-extrabold text-heading">Your answers are with the examiner</h1>
    <SendingCat
      title="Checking your speaking…"
      lines={[
        'Listening to your answers…',
        'Writing down what you said…',
        'Marking against the exam rubric…',
        'Finding what to fix first…',
      ]}
      note="This usually takes under a minute. The page updates by itself — you can leave it open."
    />
  </div>
)

/**
 * "This score looks wrong." An AI grader will sometimes be harsh or plain wrong,
 * and a student with no way to say so just loses faith in the whole product.
 *
 * It does NOT re-run the AI: the recordings were deleted after grading, so a
 * second pass would read the same transcript and reach the same score. This
 * reaches a person, which is the only thing that can actually help.
 */
function RecheckBox({ attemptId }: { attemptId: string }) {
  const queryClient = useQueryClient()
  const { data: existing, isLoading } = useQuery({
    queryKey: ['speaking-recheck', attemptId],
    queryFn: () => fetchRecheck(attemptId),
  })
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  if (isLoading) return null

  if (existing) {
    return (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-extrabold text-heading">You asked us to check this again</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              existing.status === 'open'
                ? 'bg-sun-soft text-sun-ink'
                : existing.status === 'reviewed'
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-page text-ink-soft'
            }`}
          >
            {existing.status === 'open'
              ? 'Waiting for a teacher'
              : existing.status === 'reviewed'
                ? 'Reviewed'
                : 'Closed'}
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-soft">“{existing.reason}”</p>
        {existing.admin_note && (
          <p className="mt-3 rounded-xl bg-brand-soft px-4 py-3 text-sm text-ink">
            <strong className="font-bold">Our answer:</strong> {existing.admin_note}
          </p>
        )}
      </section>
    )
  }

  const submit = async () => {
    setBusy(true)
    setProblem(null)
    try {
      await requestRecheck(attemptId, reason)
      void queryClient.invalidateQueries({ queryKey: ['speaking-recheck', attemptId] })
      setOpen(false)
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not send that.')
    } finally {
      setBusy(false)
    }
  }

  const tooShort = reason.trim().length < 10

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            Think this score is wrong? A teacher can look at your transcript.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-brand transition-colors hover:border-brand hover:bg-brand-soft"
          >
            Ask for a recheck
          </button>
        </div>
      ) : (
        <div>
          <h2 className="font-extrabold text-heading">Ask for a recheck</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Tell us what looks wrong — which question, and why you think the score is unfair. A
            teacher will read your transcript and reply here.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Example: In question 2 I answered the whole question, but the score says I was off topic."
            className="mt-3 w-full rounded-xl border border-line bg-page px-4 py-3 text-sm text-ink outline-none focus:border-brand"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || tooShort}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
            >
              Cancel
            </button>
            {tooShort && (
              <span className="text-xs text-ink-soft">Please write a little more detail.</span>
            )}
          </div>
          {problem && <p className="mt-2 text-sm text-rose-700">{problem}</p>}
        </div>
      )}
    </section>
  )
}

/** A check that failed. The recordings survive for an hour after the attempt,
 *  so within that window this really can be retried — after it, the audio is
 *  gone and there is nothing honest to offer but a re-take. */
function FailedState({
  attempt,
  onRetried,
}: {
  attempt: SpeakingAttemptRow
  onRetried: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  // THE MANIFEST IS THE EVIDENCE, NOT THE CLOCK. This used to hide the button an
  // hour after the attempt was recorded, on the assumption the sweep had run —
  // but the sweep runs hourly, on its own schedule, and grade-speaking clears
  // the manifest the moment it succeeds. So a student whose check had failed sat
  // in front of "your recordings have been deleted" while all eight clips were
  // still in the bucket, an hour of their exam thrown away for nothing
  // (2026-09-02). If the audio really is gone the retry says so, from the server,
  // which is the only place that knows.
  const retryable = !!attempt.audio_manifest?.length

  const retry = async () => {
    setBusy(true)
    setProblem(null)
    try {
      await retrySpeakingAttempt(attempt.id)
      onRetried()
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'It failed again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-10 text-center shadow-card">
      <h1 className="text-xl font-extrabold text-heading">The check did not finish</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        {attempt.error_message ?? 'Something went wrong while checking this attempt.'}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
        This did not use any of your monthly checks.
      </p>

      {retryable ? (
        <>
          <button
            type="button"
            onClick={() => void retry()}
            disabled={busy}
            className="mt-5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
          >
            {busy ? 'Checking…' : 'Try the check again'}
          </button>
          {problem && <p className="mt-3 text-sm text-rose-700">{problem}</p>}
        </>
      ) : (
        <p className="mx-auto mt-4 max-w-md text-sm text-ink-soft">
          Your recordings have been deleted, so this attempt cannot be checked again. Speak the
          paper once more to get a band score.
        </p>
      )}

      <div className="mt-5">
        <Link
          to="/speaking"
          className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
        >
          Back to Speaking
        </Link>
      </div>
    </div>
  )
}

const Notice = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-2xl border border-line bg-white p-10 text-center shadow-card">
    <h1 className="text-xl font-extrabold text-heading">{title}</h1>
    <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">{body}</p>
    <Link
      to="/speaking"
      className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
    >
      Back to Speaking
    </Link>
  </div>
)
