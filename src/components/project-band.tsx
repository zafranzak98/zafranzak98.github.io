import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import OpeningVisual from '#/components/opening-visual'
import { bandOrder } from '#/lib/project-colours.js'
import { categoryName, colourOf, openingOf, yearOf, type Project } from '#/lib/site'

// One project in the Projects lookbook: a full-width band in the project's own opening colour,
// its opening visual, and the title set large across the foot of the band. Every project uses
// this layout. A project with a case study page links to it; a "Listed only" project has no page,
// so its band is the same but not a link.
export default function ProjectBand({ p, number }: { p: Project; number: number }) {
  const o = openingOf(p)
  const hasPage = p.page_type === 'Full case study'
  const colour = colourOf(p)
  const className = `band band-${p.design ?? 'standard'}${colour === 'Off-white' ? ' band-rule' : ''}${colour === 'Olive' ? ' band-olive' : ''}`
  const style: CSSProperties = { background: o.bg, color: o.fg }
  const content = (
    <>
      <div className="band-top">
        <span>
          <b>{String(number).padStart(2, '0')}</b> · {categoryName(p.category)} · {yearOf(p)}
          {p.status === 'Draft' && <span className="draft-badge">Draft</span>}
        </span>
        <span>My role: {p.role}{hasPage && <> <span className="band-arrow" aria-hidden="true">→</span></>}</span>
      </div>
      <p className="band-line">{p.summary}</p>
      <div className="band-visual"><OpeningVisual p={p} inBand /></div>
      <b className="c band-title">{p.title}</b>
    </>
  )
  if (!hasPage) return <article className={className} style={style}>{content}</article>
  return (
    <Link to="/projects/$projectCat/$projectId/" params={{ projectCat: p.category, projectId: p.slug }} className={className} style={style}>
      {content}
    </Link>
  )
}

// Case studies first, then projects listed without a page, numbered in one sequence.
export function ProjectBands({ items }: { items: Project[] }) {
  const ordered = bandOrder(items)
  return <section className="bands">{ordered.map((p, i) => <ProjectBand key={p.slug} p={p} number={i + 1} />)}</section>
}
