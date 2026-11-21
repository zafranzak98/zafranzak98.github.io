import { Media, Phone } from '#/components/media'
import type { Project } from '#/lib/site'

// Each original case study keeps its own approved opening composition; new projects use the standard one.
// Shared by the case-study opening and the Projects lookbook, so both always show the same visual.
export default function OpeningVisual({ p, phoneWidth = 180 }: { p: Project; phoneWidth?: number }) {
  switch (p.design) {
    case 'cancel-me-not':
      return <div className="tilt"><Media img={p.cover} ratio="3/4" /></div>
    case 'evoke':
      return (
        <div className="pair">
          <Media img={p.cover_before} ratio="3/4" label="before" />
          <Media img={p.cover} ratio="3/4" label="after" />
        </div>
      )
    case 'about-face':
      return <Phone img={p.cover} width={phoneWidth} />
    case 'bersih':
      return <Media img={p.cover} ratio="4/5" label="poster" />
    default:
      return <Media img={p.cover} ratio="3/4" label="strongest image" />
  }
}
