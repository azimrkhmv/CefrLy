import type { SVGProps } from 'react'

// Small inline icon set (24px grid, stroke = currentColor) so the sidebar and
// cards never depend on an icon package.

type IconProps = SVGProps<SVGSVGElement>

function base(props: IconProps): IconProps {
  return {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  }
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  )
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 6.5C10.4 5 8.2 4.5 5.5 4.5c-.9 0-1.7.07-2.5.2V19c.8-.13 1.6-.2 2.5-.2 2.7 0 4.9.5 6.5 2 1.6-1.5 3.8-2 6.5-2 .9 0 1.7.07 2.5.2V4.7c-.8-.13-1.6-.2-2.5-.2-2.7 0-4.9.5-6.5 2Z" />
      <path d="M12 6.5V20.5" />
    </svg>
  )
}

export function HeadphonesIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 13.5V12a8 8 0 0 1 16 0v1.5" />
      <path d="M4 14.5A2.5 2.5 0 0 1 6.5 12h.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-.5A2.5 2.5 0 0 1 4 16.5v-2ZM20 14.5a2.5 2.5 0 0 0-2.5-2.5H17a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h.5a2.5 2.5 0 0 0 2.5-2.5v-2Z" />
    </svg>
  )
}

export function PenIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
      <path d="m13.5 7.5 3 3" />
    </svg>
  )
}

export function MicIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  )
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4v16h16" />
      <path d="M8 16v-5M12 16V8M16 16v-3" />
    </svg>
  )
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3 5 5.5v5c0 4.5 2.9 8.2 7 10 4.1-1.8 7-5.5 7-10v-5L12 3Z" />
    </svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...base({ fill: 'currentColor', stroke: 'none', ...props })}>
      <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" />
    </svg>
  )
}

export function FlagIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 21V4" />
      <path d="M5 5h13l-2.5 3.5L18 12H5" />
    </svg>
  )
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 12h16m0 0-6-6m6 6-6 6" />
    </svg>
  )
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 4h-8a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8" />
      <path d="M10 12h10m0 0-4-4m4 4-4 4" />
    </svg>
  )
}

export function ClipboardIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 6H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-2" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  )
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4l2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 16.9l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76L12 4Z" />
    </svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function TrendUpIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 16l5-5 3 3 6-6" />
      <path d="M15 8h4v4" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.9a7.6 7.6 0 0 0 0-3.8l2-1.5-2-3.5-2.4.9a7.6 7.6 0 0 0-3.3-1.9L13.2 1.6h-2.4L10.3 4.1a7.6 7.6 0 0 0-3.3 1.9l-2.4-.9-2 3.5 2 1.5a7.6 7.6 0 0 0 0 3.8l-2 1.5 2 3.5 2.4-.9a7.6 7.6 0 0 0 3.3 1.9l.5 2.5h2.4l.5-2.5a7.6 7.6 0 0 0 3.3-1.9l2.4.9 2-3.5Z" />
    </svg>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19v-1a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v1" />
      <path d="M16 5.3a3.2 3.2 0 0 1 0 5.4" />
      <path d="M17.4 14.3A4 4 0 0 1 20.5 18v1" />
    </svg>
  )
}
