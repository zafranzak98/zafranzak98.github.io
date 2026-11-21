import { Fragment } from 'react'
import { Link } from '@tanstack/react-router'
import { categories } from '#/lib/site'

// Category filter set as a running headline: All, then every category that has projects.
// The router marks the current page's link with aria-current, which the CSS colours terracotta.
export default function CategoryIndex({ used }: { used: Set<string> }) {
  const items = [
    { key: 'all', name: 'All' },
    ...categories.filter((c) => used.has(c.slug)).map((c) => ({ key: c.slug, name: c.name })),
  ]
  return (
    <nav aria-label="Filter by category" className="cat-index c">
      {items.map((item, i) => (
        <Fragment key={item.key}>
          {i > 0 && <span className="cat-index-sep" aria-hidden="true">/</span>}
          {item.key === 'all' ? (
            <Link to="/projects" activeOptions={{ exact: true }}>{item.name}</Link>
          ) : (
            <Link to="/projects/$projectCat" params={{ projectCat: item.key }}>{item.name}</Link>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
