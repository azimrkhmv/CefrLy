import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Link } from "react-router-dom";
import { CATS, pickCatIndex, type CatDef } from "./cats";

/** Shared chrome for every auth surface (sign in / sign up / reset password),
 *  built from design "Auth Redesign 1c — form first, cat in the nook".
 *
 *  Two layouts, one tree:
 *  · Under lg  — a single form-first column. Header is logo + one link; the cat
 *    lives at the bottom in the reassurance nook, where nothing crops it.
 *  · lg and up — a two-column split: brand panel (logo, headline, big cat
 *    under its line) beside the form. "Auth Redesign Final" dropped the
 *    floating trust badge that the earlier 1c import carried.
 *
 *  BACKGROUND (owner's design, 2026-09-24): one lavender "orbits" image
 *  (public/auth-bg.webp) spans the WHOLE page, both columns, with NOTHING laid
 *  over it — no panel fill, no white wash on the form side (a wash drew a hard
 *  seam down the middle; owner call). It replaced the inline HaloCurves art.
 *  Anchored left-bottom so the orbit rings stay behind the cat at any aspect
 *  ratio. Under lg a separate PORTRAIT cut (public/auth-bg-mobile.webp) takes
 *  over, anchored bottom so its rings sit behind the reassurance nook. Both
 *  live in CSS media rules, so each device downloads only its own image.
 *
 *  The mascot rotates per load and can be poked (see cats.ts); poking swaps its
 *  line to one of that cat's quips. BOTH layouts render that line — the desktop
 *  cat used to be mute, because the only element showing it was the lg:hidden
 *  nook. There is no speech bubble in this design: the cat's voice is set as
 *  plain copy next to it. */
export function AuthShell({
  topRight,
  line,
  sub,
  children,
}: {
  /** Optional top-corner slot: mobile header right, desktop above the form.
   *  Used for back-navigation (the reset screen's "← Sign in"). The account
   *  switch does NOT live here — it sits at the end of the form, under the
   *  Google button, so the eye meets it after the things it can act on. */
  topRight?: ReactNode;
  /** The cat's default nook line, given whichever cat was picked this load. */
  line: (cat: CatDef) => string;
  /** Steady reassurance copy under the cat's line. */
  sub: string;
  children: ReactNode;
}) {
  const [catIndex] = useState(pickCatIndex);
  const cat = CATS[catIndex];

  const [awake, setAwake] = useState(false);
  const [quipIndex, setQuipIndex] = useState(0);
  const wakeTimer = useRef<number | null>(null);
  const heroRef = useRef<HTMLImageElement | null>(null);
  const nookRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    return () => {
      if (wakeTimer.current) window.clearTimeout(wakeTimer.current);
    };
  }, []);

  const nookLine = awake ? cat.quips[quipIndex % cat.quips.length] : line(cat);

  // A one-shot squash-&-stretch when the cat is poked — a startled little hop.
  // It composites over the CSS idle breathing (same transform-origin from
  // .cat-sleep/.cat-idle), then releases back to it. Skipped for reduced-motion
  // and where the Web Animations API is unavailable.
  function poke(ref: RefObject<HTMLImageElement | null>) {
    const el = ref.current;
    if (el && typeof el.animate === "function") {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        el.animate(
          [
            { transform: "scale(1, 1)" },
            { transform: "scale(1.06, 0.9)", offset: 0.2 },
            { transform: "scale(0.95, 1.07)", offset: 0.45 },
            { transform: "scale(1.02, 0.98)", offset: 0.7 },
            { transform: "scale(1, 1)" },
          ],
          { duration: 640, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
        );
      }
    }
    if (wakeTimer.current) window.clearTimeout(wakeTimer.current);
    setAwake((wasAwake) => {
      if (wasAwake) setQuipIndex((q) => q + 1);
      return true;
    });
    wakeTimer.current = window.setTimeout(() => {
      setAwake(false);
      setQuipIndex((q) => q + 1);
    }, 2800);
  }

  const catAnim = cat.sleepy ? "cat-sleep" : "cat-idle";

  return (
    <div className="auth-scene bg-page bg-[url(/auth-bg-mobile.webp)] bg-cover bg-[position:center_bottom] bg-no-repeat lg:bg-[url(/auth-bg.webp)] lg:bg-[position:left_bottom] font-sans text-ink lg:grid lg:min-h-screen lg:grid-cols-[54fr_46fr]">
      {/* ── Brand panel (desktop only) ─────────────────────────────────────
          Decorative: the form beside it is the page's <main> landmark. */}
      <section className="relative hidden overflow-hidden px-14 pt-11 lg:flex lg:flex-col">
        <Link to="/" className="relative z-[2] flex w-fit items-center gap-3">
          <img
            src="/logo-cat.webp"
            alt=""
            aria-hidden="true"
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 object-contain"
          />
          <span className="flex flex-col gap-px">
            <span className="text-xl font-black leading-[1.1] text-ink">
              Cefrly
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">
              CEFR Exams
            </span>
          </span>
        </Link>

        {/* Pitch block: an exam paper that has just been marked. A tight
            display headline, the examiner's pen circling "minutes.", and one
            handwritten margin note carrying the facts (Behance research,
            2026-09-24: Talkie's mascot-and-scribble type, Graphéine's
            Toulouse block, "portfo/io"'s single hand-made glyph). Nothing is
            laid over the background art. The headline is a <p>, not a
            heading: the form's "Welcome back" is this page's <h1>, and an h1
            that only exists above lg would break the heading order. */}
        <div className="relative z-[2] mt-14 xl:mt-20 2xl:mt-28">
          <p className="text-[40px] font-black leading-[1.08] text-heading xl:text-[50px] 2xl:text-[56px]">
            Every CEFR paper,
            <br />
            marked in{' '}
            <span className="relative inline-block text-brand">
              minutes.
              <svg
                aria-hidden
                viewBox="0 0 200 80"
                preserveAspectRatio="none"
                className="pointer-events-none absolute -left-[10%] -top-[22%] h-[146%] w-[128%] overflow-visible text-accent"
              >
                <path
                  className="pen-circle"
                  pathLength={1}
                  d="M152 10 C 112 0, 34 4, 14 28 C 0 46, 30 74, 104 74 C 168 74, 198 54, 190 32 C 184 14, 150 4, 112 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </p>
          <p className="pen-note mt-4 ml-[18%] whitespace-nowrap font-pen text-[26px] leading-[1.05] text-brand 2xl:mt-6 2xl:text-[30px]">
            Reading, Listening, Writing, Speaking.
            <br />
            AI marks your writing and speaking.
          </p>
        </div>

        {/* The cat's line, beside the cat, so the mascot has a voice on desktop
            too (the nook that renders `nookLine` below is lg:hidden, so the
            desktop cat used to be mute). The cat is FLUID here: a fixed 400px
            cushion plus a line alongside overflows the ~400px of content width
            this panel has at 1024px, and the section's overflow-hidden would
            silently clip the words. min(heroW, 50%) lets the cushion shrink on
            narrow desktops and stop growing at its designed size on wide ones.
            -ml-3 keeps it at the design's left-11 despite the panel's px-14;
            mb-8 seats the cushion on the orbit rings, clear of the edge. */}
        <div className="relative z-[1] mt-auto mb-8 -ml-3">
          <button
            type="button"
            onClick={() => poke(heroRef)}
            aria-label="Poke the cat"
            style={{ width: cat.heroW }}
            className="block cursor-pointer select-none border-0 bg-transparent p-0"
          >
            <img
              ref={heroRef}
              src={cat.src}
              alt={cat.alt}
              draggable={false}
              width={cat.iw}
              height={cat.ih}
              // This is the desktop LCP element. It can't be preloaded from the
              // HTML (which cat renders is picked at random in JS), so at least
              // tell the browser not to queue it behind everything else.
              fetchPriority="high"
              decoding="async"
              className={`${catAnim} block h-auto w-full`}
            />
          </button>
          {/* The cat speaks in a bubble, as it always has. Keyed on the text so
              React remounts it and the bubble-pop replays on every new line.
              It floats above the cushion with the tail pointing back down at
              the cat, rather than sitting beside it as flat copy. */}
          <div
            key={nookLine}
            className="bubble-pop absolute bottom-full left-4 z-[3] mb-3 max-w-[320px] rounded-[14px] bg-white px-[15px] py-[9px] text-sm font-extrabold leading-[1.35] text-ink shadow-[0_4px_16px_color-mix(in_srgb,var(--color-brand)_10%,transparent)]"
            aria-live="polite"
          >
            {nookLine}
            <span
              className="absolute -bottom-[5px] left-[26px] h-3 w-3 rotate-45 rounded-[2px] bg-white"
              aria-hidden
            />
          </div>
        </div>

      </section>

      {/* ── Form column ───────────────────────────────────────────────────── */}
      <main className="relative flex min-h-screen flex-col px-6 pb-7 pt-4 lg:min-h-0 lg:grid lg:place-items-center lg:px-[72px] lg:py-12">
        {/* Mobile header: logo + the one contextual link. */}
        <div className="flex items-center justify-between lg:hidden">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/logo-cat.webp"
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 object-contain"
            />
            <span className="flex flex-col gap-px">
              <span className="text-[17px] font-black leading-[1.1] text-ink">
                Cefrly
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">
                CEFR Exams
              </span>
            </span>
          </Link>
          {topRight && (
            <span className="text-sm font-semibold text-ink-soft">
              {topRight}
            </span>
          )}
        </div>

        {/* Same link, parked top-right of the form column on desktop. */}
        {topRight && (
          <span className="absolute right-14 top-[46px] hidden text-sm font-semibold text-ink-soft lg:block">
            {topRight}
          </span>
        )}

        <div className="auth-glass flex w-full max-w-[456px] flex-1 flex-col lg:max-w-[544px] lg:flex-none">
          {/* Phones: the form floats in the middle of whatever height is
              left between the logo and the cat's nook (my-auto splits the
              spare space above and below it), so the nook stays pinned to the
              bottom and a tall screen gets breathing room under the logo
              instead of one big gap above the cat. With no spare space it sits
              right under the header, as before. */}
          <div className="my-auto lg:my-0">{children}</div>

          {/* Reassurance nook — mobile only. On desktop the trust badge and the
              big cat on the brand panel carry this instead. mt-auto pins it to
              the bottom of tall screens (as the design's reset screen does)
              while pt-7 keeps the designed gap on short ones. */}
          <div className="pt-7 lg:hidden">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-3 overflow-hidden rounded-[20px] bg-page/80 px-[18px]">
              <button
                type="button"
                onClick={() => poke(nookRef)}
                aria-label="Poke the cat"
                className="block cursor-pointer select-none border-0 bg-transparent p-0"
              >
                <img
                  ref={nookRef}
                  src={cat.src}
                  alt={cat.alt}
                  draggable={false}
                  width={cat.nookW}
                  style={{ width: cat.nookW }}
                  fetchPriority="high"
                  decoding="async"
                  className={`${catAnim} mt-3.5 -mb-0.5 block h-auto`}
                />
              </button>
              <span className="flex flex-col gap-1 self-center py-[18px] pb-4">
                <span
                  className="text-sm font-extrabold leading-[1.3] text-ink"
                  aria-live="polite"
                >
                  {nookLine}
                </span>
                <span className="text-[13px] font-semibold leading-[1.3] text-ink-soft">
                  {sub}
                </span>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

