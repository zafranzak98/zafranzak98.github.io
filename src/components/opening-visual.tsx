import type { CSSProperties, ReactNode } from 'react'
import { Media } from '#/components/media'
import { coverFrame, coverSizes } from '#/lib/cover-image.js'
import { photoSize, type Project } from '#/lib/site'

// Each original case study keeps its own approved opening composition; new projects use the standard one.
// Shared by the case-study opening and the Projects lookbook, so both show the same visual.
// Each cover sits at its own slight angle, after Cancel Me, Not!'s 2 degrees.
const ANGLES = [-1.75, -1.5, 1.75, 2.25]
const angleFor = (slug: string) => ANGLES[[...slug].reduce((sum, c) => sum + c.charCodeAt(0), 0) % ANGLES.length]
const Tilt = ({ deg, children }: { deg: number; children: ReactNode }) => <div className="tilt" style={{ '--tilt': `${deg}deg` } as CSSProperties}>{children}</div>

// priority: shown at the top of the page (a case study opening, or the first band on a Projects page).
export default function OpeningVisual({ p, inBand = false, priority = !inBand }: { p: Project; inBand?: boolean; priority?: boolean }) {
  // Frame shapes and widths come from src/lib/cover-image.js, shared with the build.
  const sizes = coverSizes(p.design, inBand)
  // Each image keeps its design's frame only if that frame would not crop it; otherwise it is shown
  // whole (src/lib/cover-image.js). Without an image yet, the placeholder uses a 3:4 frame.
  const frameOf = (img?: { image?: string }) => {
    const f = coverFrame(p.design, photoSize(img?.image))
    return f === 'auto' && !img?.image ? '3/4' : f
  }
  const frame = frameOf(p.cover)
  switch (p.design) {
    case 'cancel-me-not':
      return <div className="tilt"><Media priority={priority} img={p.cover} ratio={frame} sizes={sizes} /></div>
    case 'evoke':
      return (
        <div className="pair">
          <Tilt deg={-1.5}><Media priority={priority} img={p.cover_before} ratio={frameOf(p.cover_before)} label="before" sizes={sizes} /></Tilt>
          <Tilt deg={1.75}><Media priority={priority} img={p.cover} ratio={frame} label="after" sizes={sizes} /></Tilt>
        </div>
      )
    case 'about-face':
      // The cover artwork keeps its own proportions (no crop) whatever its shape.
      return <Tilt deg={-1.25}><Media priority={priority} img={p.cover} ratio={frame} label="AR filter on a face" sizes={sizes} /></Tilt>
    case 'fc-yeah':
      // The mouth artwork is a cut-out drawing, so it is shown whole rather than cropped.
      return <Tilt deg={-2.5}><Media priority={priority} img={p.cover} ratio={frame} label="strongest image" sizes={sizes} /></Tilt>
    case 'bersih':
      return <Tilt deg={1.25}><Media priority={priority} img={p.cover} ratio={frame} label="poster" sizes={sizes} /></Tilt>
    default:
      return <Tilt deg={angleFor(p.slug)}><Media priority={priority} img={p.cover} ratio={frame} label="strongest image" sizes={sizes} /></Tilt>
  }
}
