import { Fragment } from 'react'
import { PageLink } from '#/components/page-link'
import { categories, projects } from '#/lib/site'

// Category filter set as a running headline: All, then every category that has projects.
// The router marks the current page's link with aria-current, which the CSS colours terracotta;
// on a case study its category stays marked because the case study sits under that category's path.
// current: the category to mark where there is no router (the design editor).
export default function CategoryIndex({ current }: { current?: string }) {
  const used = new Set(projects.map((p) => p.category))
  // Each name carries a small count of its projects; screen readers hear "(3 projects)".
  const count = (slug?: string) => projects.filter((p) => !slug || p.category === slug).length
  const items = [
    { key: 'all', name: 'All', n: count() },
    ...categories.filter((c) => used.has(c.slug)).map((c) => ({ key: c.slug, name: c.name, n: count(c.slug) })),
  ]
  return (
    <nav aria-label="Filter by category" className="cat-index c">
      {items.map((item, i) => (
        <Fragment key={item.key}>
          {i > 0 && <><span className="cat-index-sep" aria-hidden="true">/</span><wbr /></>}
          <PageLink to={item.key === 'all' ? '/projects/' : `/projects/${item.key}/`} exact={item.key === 'all'} current={item.key === current}>{item.name}<sup className="cat-n"><span className="visually-hidden"> (</span>{item.n}<span className="visually-hidden"> {item.n === 1 ? 'project' : 'projects'})</span></sup></PageLink>
        </Fragment>
      ))}
    </nav>
  )
}
