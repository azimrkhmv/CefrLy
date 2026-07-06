// Shared volume slider for the listening players. The value lives in
// useAudioStore (and localStorage) so it carries across parts, players and
// attempts — students set it once. Clicking the speaker toggles mute.
export function VolumeControl({
  value,
  onChange,
}: {
  value: number
  onChange: (volume: number) => void
}) {
  const muted = value === 0
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(muted ? 1 : 0)}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="text-ink-soft transition-colors hover:text-ink"
      >
        {muted ? <SpeakerMutedIcon /> : <SpeakerIcon />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Volume"
        className="accent-brand h-1.5 w-20 cursor-pointer"
      />
    </div>
  )
}

function SpeakerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
      <path d="M16 9a4 4 0 0 1 0 6" />
    </svg>
  )
}
function SpeakerMutedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
      <path d="m16 9 5 6" />
      <path d="m21 9-5 6" />
    </svg>
  )
}
