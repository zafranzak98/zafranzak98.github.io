import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import OpeningVisual from '#/components/opening-visual'
import { allOrder, bandOrder } from '#/lib/project-colours.js'
import { categoryName, colourOf, highlightOnSage, openingOf, yearOf, type Project } from '#/lib/site'
import { Rich } from '#/components/rich'

// One project in the Projects lookbook: a full-width band in the project's own opening colour,
// its opening visual, and the title set large across the foot of the band. Every project uses
// this layout. A project with a case study page links to it; a "Listed only" project has no page,
// so its band is the same but not a link.
export default function ProjectBand({ p, number, first = false }: { p: Project; number: number; first?: boolean }) {
  const o = openingOf(p)
  const hasPage = p.page_type === 'Full case study'
  const colour = colourOf(p)
  const className = `band band-${p.design ?? 'standard'}${colour === 'Off-white' ? ' band-rule' : ''}${highlightOnSage(p) ? ' on-sage' : ''}`
  const style: CSSProperties = { background: o.bg, color: o.fg }
  // What the project produced, from its Deliverables, as one short line. Entries still holding a
  // [placeholder] are left out, so unfinished content never shows on the Projects page.
  const format = (p.deliverables ?? []).filter((d) => d && !d.includes('[')).join(' · ')
  const content = (
    <>
      <div className="band-top">
        <span>
          <b>{String(number).padStart(2, '0')}</b> · {categoryName(p.category)} · {yearOf(p)}
          {p.status === 'Draft' && <span className="draft-badge">Draft</span>}
        </span>
        <span>My role: <Rich text={p.role} />{hasPage && <> <span className="band-arrow" aria-hidden="true">→</span></>}</span>
      </div>
      <p className="band-line"><span><Rich text={p.summary} /></span></p>
      {format && <p className="band-format"><span>{format}</span></p>}
      <div className="band-visual"><OpeningVisual p={p} inBand priority={first} /></div>
      <b className="c band-title">{p.title}</b>
    </>
  )
  if (!hasPage) return <article className={className} style={style}>{content}</article>
  return (
    <Link to="/projects/$projectCat/$projectId/" params={{ projectCat: p.category, projectId: p.address }} className={className} style={style}>
      {content}
    </Link>
  )
}

// Case studies first, then projects listed without a page, numbered in one sequence. The All
// projects page (all) lists each group newest first; category pages keep the Order number.
export function ProjectBands({ items, all = false }: { items: Project[]; all?: boolean }) {
  const ordered = all ? allOrder(items) : bandOrder(items)
  return <section className="bands">{ordered.map((p, i) => <ProjectBand key={p.slug} p={p} number={i + 1} first={i === 0} />)}</section>
}
