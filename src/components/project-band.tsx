import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import OpeningVisual from '#/components/opening-visual'
import { OPENING, categoryName, yearOf, type Project } from '#/lib/site'

// One project in the Projects lookbook: a full-width band in the project's own opening colour,
// its opening visual, and the title set large across the foot of the band.
export default function ProjectBand({ p, number }: { p: Project; number: number }) {
  const o = OPENING[p.opening_colour]
  // Long titles step down so every title fits on one line at desktop widths.
  const titleSize = Math.min(10.8, +(128 / p.title.length).toFixed(2))
  return (
    <Link
      to="/projects/$projectCat/$projectId"
      params={{ projectCat: p.category, projectId: p.slug }}
      className={`band band-${p.design ?? 'standard'}${p.opening_colour === 'Off-white' ? ' band-rule' : ''}`}
      style={{ background: o.bg, color: o.fg, '--title': titleSize } as CSSProperties}
    >
      <div className="band-top">
        <span>
          <b>{String(number).padStart(2, '0')}</b> · {categoryName(p.category)} · {yearOf(p)}
          {p.status === 'Draft' && <span className="draft-badge">Draft</span>}
        </span>
        <span>My role: {p.role} <span className="band-arrow" aria-hidden="true">→</span></span>
      </div>
      <p className="band-line">{p.summary}</p>
      <div className="band-visual"><OpeningVisual p={p} phoneWidth="max(110px, 9.4vw)" /></div>
      <b className="c band-title">{p.title}</b>
    </Link>
  )
}

// Projects without a case study page, listed after the bands as a line of text.
export function ListedProjects({ items, startAt }: { items: Project[]; startAt: number }) {
  const label = startAt > 1 ? 'Also listed' : 'Listed project'
  if (!items.length) return null
  return (
    <section className="listed" aria-label={label}>
      {items.map((p, i) => (
        <div key={p.slug} className="listed-item">
          <span className="lab">{String(startAt + i).padStart(2, '0')} · {label} · {categoryName(p.category)} · {yearOf(p)}</span>
          <b className="c">{p.title}</b>
          <p>{p.summary}</p>
        </div>
      ))}
    </section>
  )
}
