// A paperclip holding a photo by its top-right corner. The wire is drawn twice: the part that
// lies behind the photo sits under it, the part in front sits over it, so the photo's edge
// passes between them as it would in a real clip. Purely decorative.

// The wire, in two pieces. Front: the free end and the inner loop that rests on the photo,
// plus the bend above the photo's edge. Back: the outer loop under the photo.
const FRONT = 'M7.5 30V82A4.5 4.5 0 0 0 16.5 82V14A7 7 0 0 0 2.5 14'
const BACK = 'M2.5 14V87A9.5 9.5 0 0 0 21.5 87V28'

// Three strokes give the wire a rounded, metal look: a darker edge, the body, a highlight.
function Wire({ d }: { d: string }) {
  return (
    <>
      <path d={d} stroke="#7d817a" strokeWidth="2.5" />
      <path d={d} stroke="#b7bab3" strokeWidth="1.7" />
      <path d={d} stroke="#eef0ea" strokeWidth="0.55" opacity="0.85" transform="translate(-0.4 -0.2)" />
    </>
  )
}

export function PaperClip({ layer }: { layer: 'front' | 'back' }) {
  return (
    <svg className={`paper-clip paper-clip-${layer}`} viewBox="0 0 24 100" fill="none" strokeLinecap="round" aria-hidden="true" focusable="false">
      <Wire d={layer === 'front' ? FRONT : BACK} />
    </svg>
  )
}
