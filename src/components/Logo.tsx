import { Link } from 'react-router-dom'

// The one brand lockup, shared by the app shell and the auth page.
export function Logo({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-base font-extrabold text-white">
        C
      </span>
      {compact ? (
        <span className="text-base font-extrabold tracking-tight text-heading">Cefrly</span>
      ) : (
        <span className="leading-tight">
          <span className="block text-base font-extrabold tracking-tight text-heading">
            Cefrly
          </span>
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            CEFR Exams
          </span>
        </span>
      )}
    </Link>
  )
}
