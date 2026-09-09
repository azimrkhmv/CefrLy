// Mascot alternatives shared by every auth surface (sign in / sign up / reset).
// One is picked at random per page load, so different visitors meet a different
// cat. Preview a specific one with ?cat=<key> (e.g. /login?cat=surprised).
//
// To add another alternative: drop the PNG in /public and append an entry with
// its own key, widths and personality copy.
//
// SIZING: each asset has its own aspect ratio, so a single shared width would
// render them at visibly different masses. Per the design system, match the
// visual cat/cushion MASS across cats, not the frame height — hence a per-cat
// `nookW` (the small reassurance-card cat) and `heroW` (the big desktop cat).
// The heights those produce land within ~30px of each other in both slots.
export type CatDef = {
  key: string
  src: string
  alt: string
  /** Sleepy cats breathe with .cat-sleep; awake ones use the lighter .cat-idle. */
  sleepy: boolean
  /** Intrinsic pixel size of the asset. Emitted as the img's width/height
   *  attributes so the browser can reserve the right box from the aspect ratio
   *  before the PNG arrives — without them the nook row jumps on load (CLS). */
  iw: number
  ih: number
  /** Rendered width (px) inside the mobile reassurance nook. */
  nookW: number
  /** Rendered width (px) of the big cat on the desktop brand panel. */
  heroW: number
  hello: string
  helloSignup: string
  bye: string
  quips: string[]
}

export const CATS: CatDef[] = [
  {
    key: 'sleeping',
    iw: 1065,
    ih: 700,
    src: '/cat-sleeping.png',
    alt: 'A sleepy grey cat curled up on a lavender cushion',
    sleepy: true,
    // 1065×700 — the widest, lowest composition. 132/400 are the design's own
    // numbers for this cat; the others are derived to match its mass.
    nookW: 132,
    heroW: 400,
    hello: 'Oh, you again. Welcome back.',
    helloSignup: 'A new student? Fine, I’m up…',
    bye: 'Go ahead. I’ll guard the bed.',
    quips: [
      'I was awake the whole time.',
      'Five more minutes. Then grammar.',
      'Petting is not on the syllabus.',
      'This is my study position.',
      'I dream in perfect English.',
      'Wake me for the listening part.',
      'I have already read it. Trust me.',
      'Studying is mostly lying down, yes?',
    ],
  },
  {
    key: 'surprised',
    iw: 738,
    ih: 700,
    src: '/cat-surprised.png',
    alt: 'A round grey cat sitting wide-eyed on a lavender cushion',
    sleepy: false,
    // 738×700 — nearly square, so it needs the narrowest box to avoid towering
    // over the other two.
    nookW: 96,
    heroW: 290,
    hello: 'Oh! You startled me. Welcome back.',
    helloSignup: 'A new student? I’m all eyes.',
    bye: 'Go on. I’ll be watching. Closely.',
    quips: [
      'I have simply eaten the reading paper.',
      'I am not fat. I am well-read.',
      'Who said that? ...Oh. You.',
      'I’m deeply invested in your progress.',
      'Blink twice if you brought snacks.',
      'You typed that? Bold.',
      'I have seen the answer key. I said nothing.',
      'Do not startle me. I am fragile and round.',
    ],
  },
  {
    key: 'flop',
    iw: 917,
    ih: 700,
    src: '/cat-flop.png',
    alt: 'A chubby grey cat asleep on its back on a lavender cushion',
    sleepy: true,
    // 917×700 — between the other two.
    nookW: 116,
    heroW: 370,
    hello: 'Welcome back. Excuse the pose.',
    helloSignup: 'A new student? I’d wave, but gravity.',
    bye: 'Go study. I’ll hold the floor down.',
    quips: [
      'This is advanced resting.',
      'I’m not lazy. I’m buffering.',
      'The floor needed a hug.',
      'Horizontal is a study position.',
      'Belly rubs unlock C1. Probably.',
      'I peaked. This is the peak.',
      'Gravity: 1. Me: 0.',
      'I revise with my eyes closed.',
    ],
  },
]

/** Random per load, unless ?cat=<key|index> forces one (for previewing). */
export function pickCatIndex(): number {
  const forced = new URLSearchParams(window.location.search).get('cat')
  if (forced !== null) {
    const byKey = CATS.findIndex((c) => c.key === forced)
    if (byKey >= 0) return byKey
    const n = Number(forced)
    if (Number.isInteger(n) && n >= 0 && n < CATS.length) return n
  }
  return Math.floor(Math.random() * CATS.length)
}
