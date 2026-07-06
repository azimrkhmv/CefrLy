import { useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAttemptReview } from '../lib/api'
import { imageUrl } from '../lib/storage'
import { BAND_INFO } from '../lib/bands'
import { PracticeAudioPlayer } from '../components/test/PracticeAudioPlayer'
import { PassageHtml } from '../components/test/PassageHtml'
import { CloseIcon } from '../components/icons'
import type { AttemptReview, ItemResult } from '../types/attempt'
import type { Item, ListeningPart } from '../types/test'

// The post-test STUDY view (opened from a listening result): the full
// recording up top with free controls, the paper with the student's answers on
// the left, and the transcript with question markers on the right — an
// exam-style split view with a draggable divider, one part at a time.
//
// Transcript convention (server-only `part.transcript`, revealed here after
// submission): plain text lines, `SPEAKER: utterance` for dialogue turns, and
// inline `[Qn]` wherever question n's answer is heard.

export function ReviewPage() {
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
        <p className="text-ink-soft">Loading review…</p>
      </FullScreen>
    )
  }
  if (error || !data) {
    return (
      <FullScreen center>
        <div className="space-y-4">
          <p className="text-sm text-rose-700">
            Could not load this review. {error instanceof Error ? error.message : ''}
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
  // Audio + transcript review only makes sense for listening; reading attempts
  // keep the ordinary results page.
  if (data.skill !== 'listening') return <Navigate to={`/results/${data.attemptId}`} replace />

  return <ReviewScreen review={data} />
}

function FullScreen({ children, center }: { children: ReactNode; center?: boolean }) {
  // Same portal trick as the exam player: the app shell animates `transform`,
  // which would re-anchor position:fixed, so render on <body>.
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

function ReviewScreen({ review }: { review: AttemptReview }) {
  const [partIndex, setPartIndex] = useState(0)
  const [leftPct, setLeftPct] = useState(52)
  const paneRef = useRef<HTMLDivElement>(null)

  const resultById = useMemo(() => {
    const map: Record<string, ItemResult> = {}
    for (const item of review.items) map[item.id] = item
    return map
  }, [review.items])

  const part = review.parts[partIndex]
  const partAudio = review.audioMode === 'single' ? review.singleAudio : (part?.audio ?? null)

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const container = paneRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const onMove = (e: PointerEvent) => {
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setLeftPct(Math.min(70, Math.max(30, pct)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <FullScreen>
      {/* Top bar: back + what this is + the verdict chip */}
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
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold text-heading">
                {review.testTitle}
              </h1>
              <p className="hidden text-xs text-ink-soft sm:block">
                Review — your answers, the keys and the transcript
              </p>
            </div>
          </div>
          <span className="tnum shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand">
            {review.rawScore}/{review.total}
            {/* part drills carry no CEFR band */}
            {review.band ? ` · ${BAND_INFO[review.band].label}` : ''}
          </span>
        </div>
      </header>

      {/* The recording — free controls, never auto-plays in review */}
      {partAudio && (
        <div className="shrink-0 border-b border-line bg-white px-4 py-2.5 sm:px-6">
          <PracticeAudioPlayer
            audio={partAudio}
            label={review.audioMode === 'single' ? 'Full recording' : `Part ${part?.number} recording`}
            autoStart={false}
          />
        </div>
      )}

      {/* Split view: answers | transcript */}
      <div
        ref={paneRef}
        className="flex min-h-0 flex-1 flex-col lg:flex-row"
        style={{ ['--review-left' as never]: `${leftPct}%` }}
      >
        <div className="min-w-0 overflow-y-auto p-4 sm:p-6 lg:w-[var(--review-left)]">
          {part && <ReviewPart part={part} resultById={resultById} />}
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize"
          onPointerDown={startDrag}
          className="hidden w-1.5 shrink-0 cursor-col-resize touch-none bg-line transition-colors hover:bg-brand lg:block"
        />
        <div className="min-w-0 flex-1 overflow-y-auto border-t border-line bg-white p-4 sm:p-6 lg:border-t-0">
          {part && <TranscriptPane part={part} />}
        </div>
      </div>

      {/* Bottom part tabs, like the exam */}
      <footer className="shrink-0 border-t border-line bg-white px-4 py-2.5 sm:px-6">
        <nav
          className="mx-auto flex w-fit max-w-full overflow-x-auto whitespace-nowrap rounded-xl border border-line bg-white p-1"
          aria-label="Review parts"
        >
          {review.parts.map((p, index) => {
            const partScore = partItemsOf(p).reduce(
              (s, item) => s + (resultById[item.id]?.correct ? 1 : 0),
              0,
            )
            return (
              <button
                key={p.id}
                onClick={() => setPartIndex(index)}
                className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                  index === partIndex ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
                }`}
              >
                Part {p.number}
                <span className={`tnum ml-1.5 text-xs ${index === partIndex ? 'text-white/80' : ''}`}>
                  {partScore}/{partItemsOf(p).length}
                </span>
              </button>
            )
          })}
        </nav>
      </footer>
    </FullScreen>
  )
}

function partItemsOf(part: ListeningPart): Item[] {
  if (part.groups && part.groups.length > 0) return part.groups.flatMap((g) => g.items)
  return part.items ?? []
}

// ---- Left pane: the paper with the student's answers -------------------------

function ReviewPart({
  part,
  resultById,
}: {
  part: ListeningPart
  resultById: Record<string, ItemResult>
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-heading">Part {part.number}</h2>
        <p className="mt-1 text-sm text-ink-soft">{part.instructions}</p>
      </div>

      {(part.layout === 'form_completion' || part.layout === 'note_completion') && (
        <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
          {part.stem?.title && (
            <h3 className="mb-4 text-base font-extrabold text-heading">{part.stem.title}</h3>
          )}
          <div className="space-y-1.5 text-sm leading-loose text-ink">
            <PassageHtml
              html={part.stem?.html ?? ''}
              renderGap={(itemId) => <GapReview result={resultById[itemId]} />}
            />
          </div>
        </div>
      )}

      {(part.layout === 'matching' || part.layout === 'map_labelling') && (
        <>
          {part.image && (
            <img
              src={imageUrl(part.image.assetPath)}
              alt={part.image.alt}
              className="w-full rounded-2xl border border-line bg-white shadow-card"
            />
          )}
          {part.layout === 'matching' && part.optionPool && (
            <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
              <ul className="grid gap-1 text-sm text-ink sm:grid-cols-2">
                {part.optionPool.map((o) => (
                  <li key={o.key}>
                    <span className="font-bold">{o.key}</span> {o.label !== o.key && o.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ol className="space-y-2.5">
            {(part.items ?? []).map((item) => (
              <MatchReview key={item.id} item={item} result={resultById[item.id]} pool={part.optionPool ?? []} />
            ))}
          </ol>
        </>
      )}

      {part.layout === 'mcq_response' && (
        <ol className="space-y-3">
          {(part.items ?? []).map((item) => (
            <McqReview key={item.id} item={item} result={resultById[item.id]} />
          ))}
        </ol>
      )}

      {part.layout === 'multi_extract_mcq' && (
        <div className="space-y-5">
          {(part.groups ?? []).map((group) => (
            <div key={group.id} className="space-y-3">
              <p className="text-sm font-bold text-ink">{group.context}</p>
              <ol className="space-y-3">
                {group.items.map((item) => (
                  <McqReview key={item.id} item={item} result={resultById[item.id]} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Inline chip inside form/note stems: the student's word, then the key. */
function GapReview({ result }: { result?: ItemResult }) {
  if (!result) return null
  const numberMatch = result.id.match(/q(\d+)$/)
  return (
    <span className="mx-1 inline-flex items-center gap-1.5 align-baseline">
      <span className="q-badge">{numberMatch ? numberMatch[1] : ''}</span>
      <span
        className={`rounded-lg border px-2 py-0.5 text-sm font-bold ${
          result.correct
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}
      >
        {result.userAnswerLabel ?? '—'}
      </span>
      {!result.correct && (
        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-sm font-bold text-emerald-800">
          ✓ {result.correctAnswerLabel}
        </span>
      )}
    </span>
  )
}

function MatchReview({
  item,
  result,
  pool,
}: {
  item: Item
  result?: ItemResult
  pool: { key: string; label: string }[]
}) {
  if (!result) return null
  const numberMatch = result.id.match(/q(\d+)$/)
  const chosen = result.userAnswer
  const chosenLabel = pool.find((o) => o.key === chosen)?.label
  return (
    <li className="flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-white p-3.5 shadow-card">
      <span className="q-badge">{numberMatch ? numberMatch[1] : ''}</span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
        {'prompt' in item ? item.prompt : ''}
      </span>
      <span
        className={`rounded-lg border px-2.5 py-1 text-sm font-bold ${
          result.correct
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}
        title={chosenLabel && chosenLabel !== chosen ? chosenLabel : undefined}
      >
        {chosen ?? '—'}
      </span>
      {!result.correct && (
        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-800">
          ✓ {result.correctAnswerLabel}
        </span>
      )}
    </li>
  )
}

function McqReview({ item, result }: { item: Item; result?: ItemResult }) {
  if (!result || item.type !== 'mcq') return null
  const numberMatch = result.id.match(/q(\d+)$/)
  return (
    <li className="rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="q-badge">{numberMatch ? numberMatch[1] : ''}</span>
        <div className="min-w-0 flex-1">
          {item.prompt && <p className="mb-2 text-sm font-semibold text-ink">{item.prompt}</p>}
          <ul className="space-y-1.5">
            {item.options.map((option) => {
              const isKey = option.key === item.answer
              const isChosen = option.key === result.userAnswer
              return (
                <li
                  key={option.key}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                    isKey
                      ? 'border-emerald-200 bg-emerald-50 font-bold text-emerald-800'
                      : isChosen
                        ? 'border-rose-200 bg-rose-50 font-bold text-rose-800'
                        : 'border-line text-ink'
                  }`}
                >
                  <span className="font-bold">{option.key}.</span>
                  <span className="min-w-0 flex-1">{option.label}</span>
                  {isKey && <span aria-hidden>✓</span>}
                  {isChosen && !isKey && <span aria-hidden>✗</span>}
                  {isChosen && (
                    <span className="text-[11px] font-bold uppercase tracking-wide">you</span>
                  )}
                </li>
              )
            })}
          </ul>
          {result.userAnswer === null && (
            <p className="mt-1.5 text-xs italic text-ink-soft">You left this one blank.</p>
          )}
        </div>
      </div>
    </li>
  )
}

// ---- Right pane: the transcript ----------------------------------------------

const SPEAKER_RE = /^([A-Z][A-Za-z .'’-]{0,24}):\s*(.*)$/
const Q_MARK_RE = /\[Q(\d+)\]/g

function TranscriptPane({ part }: { part: ListeningPart }) {
  const transcript = part.transcript?.trim()
  return (
    <div>
      <h2 className="text-sm font-extrabold uppercase tracking-[0.14em] text-heading">
        Part {part.number} — Transcript
      </h2>
      {!transcript ? (
        <p className="mt-4 text-sm italic text-ink-soft">
          The transcript for this part hasn’t been added yet.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {transcript.split('\n').map((rawLine, index) => {
            const line = rawLine.trim()
            if (!line) return null
            const match = line.match(SPEAKER_RE)
            return (
              <div key={index} className="flex gap-3 text-sm leading-relaxed">
                {match ? (
                  <>
                    <span className="w-24 shrink-0 pt-px text-right text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
                      {match[1]}
                    </span>
                    <p className="min-w-0 flex-1 text-ink">{renderQMarks(match[2])}</p>
                  </>
                ) : (
                  <p className="min-w-0 flex-1 italic text-ink-soft">{renderQMarks(line)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Inline [Qn] markers become little brand badges beside the line. */
function renderQMarks(text: string): ReactNode {
  const segments = text.split(Q_MARK_RE)
  if (segments.length === 1) return text
  return segments.map((segment, index) =>
    index % 2 === 1 ? (
      <span
        key={index}
        className="mx-1 inline-block rounded-md bg-brand-soft px-1.5 py-0.5 align-middle text-[11px] font-extrabold text-brand"
      >
        Q{segment}
      </span>
    ) : (
      <span key={index}>{segment}</span>
    ),
  )
}
