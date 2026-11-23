import type { CSSProperties, ReactNode } from 'react'
import { Media } from '#/components/media'
import type { Project } from '#/lib/site'

// Each original case study keeps its own approved opening composition; new projects use the standard one.
// Shared by the case-study opening and the Projects lookbook, so both show the same visual.
// Each cover sits at its own slight angle, after Cancel Me, Not!'s 2 degrees.
const ANGLES = [-1.75, -1.5, 1.75, 2.25]
const angleFor = (slug: string) => ANGLES[[...slug].reduce((sum, c) => sum + c.charCodeAt(0), 0) % ANGLES.length]
const Tilt = ({ deg, children }: { deg: number; children: ReactNode }) => <div className="tilt" style={{ '--tilt': `${deg}deg` } as CSSProperties}>{children}</div>

export default function OpeningVisual({ p, inBand = false }: { p: Project; inBand?: boolean }) {
  // How wide the visual is shown: a band's visual (15vw, Evoke 24.5vw; most of the width on a
  // phone) or a case study opening (up to 26vw; 250px on a phone). Evoke shows two images side by side.
  const sizes = inBand ? (p.design === 'evoke' ? '(max-width: 899px) 80vw, 24.5vw' : '(max-width: 899px) 62vw, 15vw') : '(max-width: 899px) 250px, 26vw'
  const half = inBand ? '(max-width: 899px) 40vw, 12.5vw' : '(max-width: 899px) 125px, 13vw'
  switch (p.design) {
    case 'cancel-me-not':
      return <div className="tilt"><Media img={p.cover} ratio="3/4" sizes={sizes} /></div>
    case 'evoke':
      return (
        <div className="pair">
          <Tilt deg={-1.5}><Media img={p.cover_before} ratio="3/4" label="before" sizes={half} /></Tilt>
          <Tilt deg={1.75}><Media img={p.cover} ratio="3/4" label="after" sizes={half} /></Tilt>
        </div>
      )
    case 'about-face':
      // The cover artwork keeps its own proportions (no crop).
      return <Tilt deg={-1.25}><Media img={p.cover} ratio={p.cover?.image ? 'auto' : '3/4'} label="AR filter on a face" sizes={sizes} /></Tilt>
    case 'fc-yeah':
      // The mouth artwork is a cut-out drawing, so it is shown whole rather than cropped.
      return <Tilt deg={-2.5}><Media img={p.cover} ratio={p.cover?.image ? 'auto' : '3/4'} label="strongest image" sizes={sizes} /></Tilt>
    case 'bersih':
      return <Tilt deg={1.25}><Media img={p.cover} ratio="4/5" label="poster" sizes={sizes} /></Tilt>
    default:
      return <Tilt deg={angleFor(p.slug)}><Media img={p.cover} ratio="3/4" label="strongest image" sizes={sizes} /></Tilt>
  }
}
