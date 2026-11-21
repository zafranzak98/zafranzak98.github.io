import { Link } from '@tanstack/react-router'
import { Media } from '#/components/media'
import { categoryName, yearOf, type Project } from '#/lib/site'

function RowBody({ p }: { p: Project }) {
  return (
    <>
      <div className="row-img">
        <Media img={p.cover} ratio="4/3" label={`${p.title} lead image`} />
      </div>
      <div className="row-text">
        <span className="lab">
          {categoryName(p.category)} · {yearOf(p)}
          {p.status === 'Draft' && <span className="draft-badge">Draft</span>}
        </span>
        <b className="c row-title">{p.title}</b>
        <p className="row-line">{p.summary}</p>
        <p className="row-role"><b>My role:</b> {p.role}</p>
      </div>
    </>
  )
}

// One project in the Projects and category lists. "Listed only" projects have no page, so no link.
export default function ProjectRow({ p }: { p: Project }) {
  if (p.page_type !== 'Full case study') {
    return <div className="row"><RowBody p={p} /></div>
  }
  return (
    <Link to="/projects/$projectCat/$projectId" params={{ projectCat: p.category, projectId: p.slug }} className="row row-link">
      <RowBody p={p} />
      <span className="row-arrow" aria-hidden="true">→</span>
    </Link>
  )
}
