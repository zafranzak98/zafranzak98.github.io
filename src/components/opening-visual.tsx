import { Media, Phone } from '#/components/media'
import type { Project } from '#/lib/site'

// Each original case study keeps its own approved opening composition; new projects use the standard one.
// Shared by the case-study opening and the Projects lookbook, so both show the same visual, with one
// exception: About-Face Beauty's band shows its cover artwork as it is, without the phone frame.
export default function OpeningVisual({ p, phoneWidth = 'max(140px, 12.4vw)', inBand = false }: { p: Project; phoneWidth?: string; inBand?: boolean }) {
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
      // In the band the artwork keeps its own proportions (no crop); the case study keeps the phone.
      if (inBand) return <Media img={p.cover} ratio={p.cover?.image ? 'auto' : '3/4'} label="AR filter on a face" />
      return <Phone img={p.cover} width={phoneWidth} />
    case 'bersih':
      return <Media img={p.cover} ratio="4/5" label="poster" />
    default:
      return <Media img={p.cover} ratio="3/4" label="strongest image" />
  }
}
