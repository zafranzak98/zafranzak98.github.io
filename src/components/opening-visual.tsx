import { Media } from '#/components/media'
import type { Project } from '#/lib/site'

// Each original case study keeps its own approved opening composition; new projects use the standard one.
// Shared by the case-study opening and the Projects lookbook, so both show the same visual.
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
          <Media img={p.cover_before} ratio="3/4" label="before" sizes={half} />
          <Media img={p.cover} ratio="3/4" label="after" sizes={half} />
        </div>
      )
    case 'about-face':
      // The cover artwork keeps its own proportions (no crop).
      return <Media img={p.cover} ratio={p.cover?.image ? 'auto' : '3/4'} label="AR filter on a face" sizes={sizes} />
    case 'bersih':
      return <Media img={p.cover} ratio="4/5" label="poster" sizes={sizes} />
    default:
      return <Media img={p.cover} ratio="3/4" label="strongest image" sizes={sizes} />
  }
}
