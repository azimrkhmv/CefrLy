import { Link } from 'react-router-dom'

// The one brand lockup, shared by the app shell and the auth page.
export function Logo({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo-cat.webp"
        alt=""
        aria-hidden="true"
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 object-contain"
      />
      {compact ? (
        <span className="text-base font-extrabold tracking-tight text-heading">Cefrly</span>
      ) : (
        <span className="leading-tight">
          <span className="block text-base font-extrabold tracking-tight text-heading">
            Cefrly
          </span>
          {/* ink-soft, not ink-faint: this is informational text and ink-faint
              is 2.0:1 on white (fails WCAG AA). */}
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            CEFR Exams
          </span>
        </span>
      )}
    </Link>
  )
}
