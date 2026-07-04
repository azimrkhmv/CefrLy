import type { ReactElement, SVGProps } from 'react'

// Cefrly's mascot: an original flat violet cat, drawn from simple shapes so
// every pose stays on-model. Poses map to contexts:
//   read      — hero / reading catalog
//   nap       — empty states ("nothing here yet")
//   celebrate — results with a good band (B2+)
//   encourage — results with a lower band
//   welcome   — login panel: lying down, waving hello
//   peek      — small accent (peeking over an edge)
//   avatar    — header account button
export type CatPose = 'read' | 'nap' | 'celebrate' | 'encourage' | 'welcome' | 'peek' | 'avatar'

const VIOLET = '#8b5cf6'
const VIOLET_DEEP = '#6d48d8'
const LIGHT = '#f1ecfe'
const PINK = '#f4a9c4'
const INK = '#2f2e41'
const SUN = '#f6ad3c'
const GREEN = '#22a06b'
const BRAND = '#3f2682'

type PoseProps = Omit<SVGProps<SVGSVGElement>, 'children'>
type CatProps = { pose: CatPose } & PoseProps

function Head({ cx = 70, cy = 52, r = 26, mood = 'open' as 'open' | 'closed' | 'down' }) {
  return (
    <g>
      {/* ears */}
      <path d={`M${cx - 20},${cy - 16} L${cx - 26},${cy - 40} L${cx - 4},${cy - 26} Z`} fill={VIOLET} />
      <path d={`M${cx + 20},${cy - 16} L${cx + 26},${cy - 40} L${cx + 4},${cy - 26} Z`} fill={VIOLET} />
      <path d={`M${cx - 17},${cy - 21} L${cx - 21},${cy - 34} L${cx - 9},${cy - 26} Z`} fill={PINK} />
      <path d={`M${cx + 17},${cy - 21} L${cx + 21},${cy - 34} L${cx + 9},${cy - 26} Z`} fill={PINK} />
      {/* head */}
      <circle cx={cx} cy={cy} r={r} fill={VIOLET} />
      {/* forehead stripes */}
      <rect x={cx - 7} y={cy - r + 2} width={4} height={9} rx={2} fill={VIOLET_DEEP} />
      <rect x={cx + 3} y={cy - r + 2} width={4} height={9} rx={2} fill={VIOLET_DEEP} />
      {/* muzzle */}
      <ellipse cx={cx} cy={cy + 10} rx={11} ry={7.5} fill={LIGHT} />
      <path
        d={`M${cx - 2.6},${cy + 6.2} L${cx + 2.6},${cy + 6.2} L${cx},${cy + 9} Z`}
        fill={PINK}
      />
      <path
        d={`M${cx - 4},${cy + 12} Q${cx},${cy + 15.5} ${cx + 4},${cy + 12}`}
        fill="none"
        stroke={INK}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {/* eyes */}
      {mood === 'closed' || mood === 'down' ? (
        <>
          <path
            d={`M${cx - 15},${cy - 1} Q${cx - 11},${cy + 3} ${cx - 7},${cy - 1}`}
            fill="none"
            stroke={INK}
            strokeWidth={2}
            strokeLinecap="round"
          />
          <path
            d={`M${cx + 7},${cy - 1} Q${cx + 11},${cy + 3} ${cx + 15},${cy - 1}`}
            fill="none"
            stroke={INK}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx={cx - 11} cy={cy - 1} r={3.4} fill={INK} />
          <circle cx={cx + 11} cy={cy - 1} r={3.4} fill={INK} />
          <circle cx={cx - 10} cy={cy - 2.2} r={1.1} fill="#fff" />
          <circle cx={cx + 12} cy={cy - 2.2} r={1.1} fill="#fff" />
        </>
      )}
      {/* whiskers */}
      <g stroke="#ffffff" strokeOpacity={0.65} strokeWidth={1.2} strokeLinecap="round">
        <path d={`M${cx - 14},${cy + 9} L${cx - 24},${cy + 7}`} />
        <path d={`M${cx - 14},${cy + 12} L${cx - 24},${cy + 13}`} />
        <path d={`M${cx + 14},${cy + 9} L${cx + 24},${cy + 7}`} />
        <path d={`M${cx + 14},${cy + 12} L${cx + 24},${cy + 13}`} />
      </g>
    </g>
  )
}

function SittingBody() {
  return (
    <g>
      <ellipse cx={70} cy={90} rx={30} ry={23} fill={VIOLET} />
      <ellipse cx={70} cy={95} rx={16} ry={13} fill={LIGHT} />
      {/* front paws */}
      <circle cx={59} cy={108} r={6} fill={VIOLET} />
      <circle cx={81} cy={108} r={6} fill={VIOLET} />
    </g>
  )
}

function Tail({ d = 'M98,94 Q120,88 114,66' }) {
  return (
    <path d={d} fill="none" stroke={VIOLET_DEEP} strokeWidth={7} strokeLinecap="round" />
  )
}

function Celebrate(props: PoseProps) {
  return (
    <svg viewBox="0 0 140 120" {...props} role="img" aria-label="Celebrating cat">
      {/* confetti */}
      <circle cx={20} cy={26} r={3} fill={SUN} />
      <circle cx={120} cy={20} r={3} fill={GREEN} />
      <rect x={30} y={8} width={6} height={6} rx={1.5} fill={VIOLET} transform="rotate(20 33 11)" />
      <rect x={104} y={40} width={6} height={6} rx={1.5} fill={SUN} transform="rotate(-15 107 43)" />
      <circle cx={12} cy={54} r={2.5} fill={VIOLET} />
      <circle cx={130} cy={62} r={2.5} fill={PINK} />
      <rect x={62} y={2} width={5} height={5} rx={1.2} fill={GREEN} transform="rotate(30 64 4)" />
      <Tail />
      {/* raised arms */}
      <path d="M48,80 L34,58" stroke={VIOLET} strokeWidth={9} strokeLinecap="round" />
      <path d="M92,80 L106,58" stroke={VIOLET} strokeWidth={9} strokeLinecap="round" />
      <circle cx={33} cy={56} r={6.5} fill={VIOLET} />
      <circle cx={107} cy={56} r={6.5} fill={VIOLET} />
      <SittingBody />
      <Head />
    </svg>
  )
}

function Encourage(props: PoseProps) {
  return (
    <svg viewBox="0 0 140 120" {...props} role="img" aria-label="Cat holding a pencil">
      <Tail />
      <SittingBody />
      {/* raised arm with pencil */}
      <path d="M94,80 L110,60" stroke={VIOLET} strokeWidth={9} strokeLinecap="round" />
      <circle cx={111} cy={58} r={6.5} fill={VIOLET} />
      <g transform="rotate(-30 111 58)">
        <rect x={104} y={34} width={7} height={28} rx={2} fill={SUN} />
        <path d="M104,34 L111,34 L107.5,25 Z" fill={INK} />
        <rect x={104} y={58} width={7} height={5} rx={2} fill={PINK} />
      </g>
      <Head />
    </svg>
  )
}

function Read(props: PoseProps) {
  return (
    <svg viewBox="0 0 140 120" {...props} role="img" aria-label="Cat reading a book">
      <Tail d="M100,90 Q122,84 116,62" />
      <ellipse cx={70} cy={86} rx={30} ry={22} fill={VIOLET} />
      <Head cy={50} mood="down" />
      {/* open book */}
      <path d="M28,94 L70,86 L112,94 L112,112 L70,103 L28,112 Z" fill={BRAND} />
      <path d="M33,95.5 L70,88 L70,101 L33,108 Z" fill="#fbfaff" />
      <path d="M107,95.5 L70,88 L70,101 L107,108 Z" fill="#fbfaff" />
      <g stroke="#cfc7ec" strokeWidth={1.6} strokeLinecap="round">
        <path d="M40,97 L62,92.6" />
        <path d="M40,101 L62,96.6" />
        <path d="M100,97 L78,92.6" />
        <path d="M100,101 L78,96.6" />
      </g>
      {/* paws on the book */}
      <circle cx={52} cy={88} r={5.5} fill={VIOLET} />
      <circle cx={88} cy={88} r={5.5} fill={VIOLET} />
    </svg>
  )
}

function Nap(props: PoseProps) {
  return (
    <svg viewBox="0 0 140 120" {...props} role="img" aria-label="Sleeping cat on a pile of books">
      {/* book stack */}
      <rect x={30} y={97} width={84} height={10} rx={3} fill={BRAND} />
      <rect x={38} y={107} width={68} height={9} rx={3} fill={SUN} />
      {/* body */}
      <ellipse cx={78} cy={82} rx={34} ry={17} fill={VIOLET} />
      <Tail d="M108,88 Q122,94 100,97" />
      {/* resting head */}
      <g>
        <path d="M28,64 L24,46 L42,56 Z" fill={VIOLET} />
        <path d="M54,62 L60,46 L42,54 Z" fill={VIOLET} />
        <circle cx={42} cy={76} r={20} fill={VIOLET} />
        <rect x={36} y={57} width={4} height={8} rx={2} fill={VIOLET_DEEP} />
        <rect x={44} y={57} width={4} height={8} rx={2} fill={VIOLET_DEEP} />
        <path
          d="M28,76 Q32,80 36,76"
          fill="none"
          stroke={INK}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <path
          d="M46,76 Q50,80 54,76"
          fill="none"
          stroke={INK}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <ellipse cx={41} cy={86} rx={9} ry={6} fill={LIGHT} />
        <path d="M38.8,83.4 L43.2,83.4 L41,85.8 Z" fill={PINK} />
      </g>
      {/* z z */}
      <g fill={VIOLET_DEEP} fontFamily="inherit" fontWeight={800}>
        <text x={100} y={52} fontSize={15}>z</text>
        <text x={112} y={40} fontSize={11}>z</text>
        <text x={121} y={31} fontSize={8}>z</text>
      </g>
    </svg>
  )
}

// The comedy flop: melted onto the bed, rump up, face squashed on the
// mattress, heavy-lidded "completely done" eyes and a deadpan mouth.
function Welcome(props: PoseProps) {
  return (
    <svg viewBox="0 0 200 140" {...props} role="img" aria-label="Grumpy cat flopped on a bed">
      {/* floor shadow */}
      <ellipse cx={100} cy={130} rx={82} ry={7} fill="#ece5fb" />
      {/* bed: base and mattress */}
      <rect x={20} y={98} width={160} height={26} rx={13} fill="#d3c3f5" />
      <rect x={27} y={88} width={146} height={20} rx={10} fill="#e7defc" />
      {/* blanket folded over the foot of the bed */}
      <path d="M138,88 L174,88 Q177,98 174,110 L138,110 Q143,99 138,88 Z" fill="#f7f4ff" />
      <path d="M145,88 Q150,99 145,110" fill="none" stroke="#ded2f7" strokeWidth={2} strokeLinecap="round" />
      {/* tail draped over the bed edge, curling at the tip */}
      <path
        d="M158,84 Q176,92 174,110 Q172,124 159,121"
        fill="none"
        stroke={VIOLET_DEEP}
        strokeWidth={7}
        strokeLinecap="round"
      />
      {/* body melted along the bed, rump exaggerated up high */}
      <path
        d="M52,93 C52,80 64,70 86,66 C104,50 148,42 158,66 C166,82 158,96 138,96 L66,96 C56,96 52,95 52,93 Z"
        fill={VIOLET}
      />
      {/* rump highlight */}
      <path
        d="M118,62 Q144,54 152,72"
        fill="none"
        stroke={VIOLET_DEEP}
        strokeWidth={2}
        strokeOpacity={0.45}
        strokeLinecap="round"
      />
      {/* back stripes riding the rump */}
      <g stroke={VIOLET_DEEP} strokeWidth={6} strokeLinecap="round">
        <path d="M116,56 L113,68" />
        <path d="M132,51 L131,64" />
        <path d="M147,54 L148,67" />
      </g>
      {/* hind paw peeking from under the rump */}
      <ellipse cx={144} cy={94} rx={11} ry={5.5} fill={LIGHT} />
      {/* front paw resting on the mattress */}
      <ellipse cx={84} cy={95} rx={10} ry={4.5} fill={VIOLET} />
      <g stroke={VIOLET_DEEP} strokeWidth={1.2} strokeLinecap="round" strokeOpacity={0.5}>
        <path d="M81,93.5 L81,96.5" />
        <path d="M85,93.5 L85,96.5" />
      </g>
      {/* the other paw dangling lazily over the edge */}
      <path d="M65,90 L62,114" stroke={VIOLET} strokeWidth={9} strokeLinecap="round" />
      <circle cx={62} cy={116} r={5.5} fill={VIOLET} />
      <g stroke={LIGHT} strokeWidth={1.3} strokeLinecap="round">
        <path d="M59.8,114.5 L59.8,117.5" />
        <path d="M63.2,114.5 L63.2,117.5" />
      </g>

      {/* squashed head, cheek on the mattress */}
      <path d="M32,64 L25,42 L49,55 Z" fill={VIOLET} />
      <path d="M74,62 L82,45 L58,53 Z" fill={VIOLET} />
      <path d="M34.5,59.5 L30,45 L45,54 Z" fill={PINK} />
      <path d="M70.5,58 L75,48 L61,53.5 Z" fill={PINK} />
      <ellipse cx={52} cy={75} rx={27} ry={20} fill={VIOLET} />
      <rect x={44} y={56} width={4} height={9} rx={2} fill={VIOLET_DEEP} />
      <rect x={54} y={55} width={4} height={9} rx={2} fill={VIOLET_DEEP} />

      {/* heavy-lidded, completely-done eyes */}
      <path d="M35.5,75 A5.5,5.5 0 0 0 46.5,75 Z" fill={INK} />
      <path d="M57.5,75 A5.5,5.5 0 0 0 68.5,75 Z" fill={INK} />
      <g stroke={INK} strokeWidth={2.2} strokeLinecap="round">
        <path d="M34.5,74.5 L47.5,74.5" />
        <path d="M56.5,74.5 L69.5,74.5" />
      </g>

      {/* muzzle: deadpan flat mouth */}
      <ellipse cx={52} cy={85.5} rx={10.5} ry={6.5} fill={LIGHT} />
      <path d="M49.4,81 L54.6,81 L52,83.8 Z" fill={PINK} />
      <path d="M48,88 L56,88" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />

      {/* whiskers drooping */}
      <g stroke="#ffffff" strokeOpacity={0.65} strokeWidth={1.2} strokeLinecap="round">
        <path d="M38,84 L26,86" />
        <path d="M39,87.5 L27,91" />
        <path d="M66,84 L78,86" />
        <path d="M65,87.5 L77,91" />
      </g>
    </svg>
  )
}

function Peek(props: PoseProps) {
  return (
    <svg viewBox="0 0 140 76" {...props} role="img" aria-label="Cat peeking">
      <Head cx={70} cy={44} r={24} />
      <circle cx={42} cy={68} r={7} fill={VIOLET} />
      <circle cx={98} cy={68} r={7} fill={VIOLET} />
      <g stroke={VIOLET_DEEP} strokeWidth={1.4} strokeLinecap="round">
        <path d="M40,64 L40,68" />
        <path d="M44,64 L44,68" />
        <path d="M96,64 L96,68" />
        <path d="M100,64 L100,68" />
      </g>
    </svg>
  )
}

function Avatar(props: PoseProps) {
  return (
    <svg viewBox="0 0 48 48" {...props} role="img" aria-label="Cat avatar">
      <circle cx={24} cy={24} r={24} fill={LIGHT} />
      <path d="M10,20 L7,6 L20,14 Z" fill={VIOLET} />
      <path d="M38,20 L41,6 L28,14 Z" fill={VIOLET} />
      <path d="M11.5,17 L10,9.5 L17,14 Z" fill={PINK} />
      <path d="M36.5,17 L38,9.5 L31,14 Z" fill={PINK} />
      <circle cx={24} cy={27} r={17} fill={VIOLET} />
      <rect x={19} y={11} width={3.2} height={7} rx={1.6} fill={VIOLET_DEEP} />
      <rect x={25.8} y={11} width={3.2} height={7} rx={1.6} fill={VIOLET_DEEP} />
      <circle cx={17.5} cy={26} r={2.6} fill={INK} />
      <circle cx={30.5} cy={26} r={2.6} fill={INK} />
      <circle cx={18.3} cy={25.1} r={0.9} fill="#fff" />
      <circle cx={31.3} cy={25.1} r={0.9} fill="#fff" />
      <ellipse cx={24} cy={33} rx={7} ry={5} fill={LIGHT} />
      <path d="M22.2,30.6 L25.8,30.6 L24,32.6 Z" fill={PINK} />
      <path
        d="M21.5,34.5 Q24,36.8 26.5,34.5"
        fill="none"
        stroke={INK}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </svg>
  )
}

const POSES: Record<CatPose, (props: PoseProps) => ReactElement> = {
  celebrate: Celebrate,
  encourage: Encourage,
  read: Read,
  nap: Nap,
  welcome: Welcome,
  peek: Peek,
  avatar: Avatar,
}

export function Cat({ pose, ...props }: CatProps) {
  const Pose = POSES[pose]
  return <Pose {...props} />
}
