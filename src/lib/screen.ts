import { useEffect, useState } from 'react'

/**
 * A full 35-question paper is a split pane — passage on one side, questions on
 * the other — with a 60-minute server-side clock. On a phone that collapses to
 * scrolling back and forth between a text and its questions, and an abandoned
 * attempt is not free: start-session has already opened a session, and on a
 * premium test it has already spent the student's monthly allowance.
 *
 * So full mocks are held back on small screens. PART DRILLS ARE NOT — six to
 * eight questions on one passage read fine on a phone, and they are how a
 * mobile-first student keeps practising. Speaking is untouched (a phone mic is
 * the better device for it).
 *
 * 768px, not 1024: a tablet in landscape and a small laptop both handle the
 * split pane, and blocking them would cost far more than it protects.
 */
const EXAM_MIN_WIDTH = 768

const QUERY = `(min-width: ${EXAM_MIN_WIDTH}px)`

/** True while the viewport is too narrow to sit a full paper. Follows resize
 *  and orientation changes, so turning a phone sideways is not enough but a
 *  tablet rotating into landscape is. */
export function useScreenTooSmallForExam(): boolean {
  const [small, setSmall] = useState(
    () => typeof window !== 'undefined' && !window.matchMedia(QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const update = () => setSmall(!mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return small
}
