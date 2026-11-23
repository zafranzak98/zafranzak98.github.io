import { Fragment, createContext, useContext } from 'react'
import { Editing } from '#/layout/elements'
import { PageLink } from '#/components/page-link'
import { categories, projects } from '#/lib/site'

// Category filter set as a running headline: All, then every category that has projects.
// The router marks the current page's link with aria-current, which the CSS colours terracotta;
// on a case study its category stays marked because the case study sits under that category's path.
// current: the category to mark where there is no router (the design editor).
// In the design editor each name can be selected and retyped; the names being edited arrive here.
export const CategoryNames = createContext<Record<string, string>>({})
export default function CategoryIndex({ current }: { current?: string }) {
  const editing = useContext(Editing)
  const renamed = useContext(CategoryNames)
  const used = new Set(projects.map((p) => p.category))
  const items = [
    { key: 'all', name: 'All' },
    ...categories.filter((c) => used.has(c.slug)).map((c) => ({ key: c.slug, name: c.name })),
  ]
  return (
    <nav aria-label="Filter by category" className="cat-index c">
      {items.map((item, i) => (
        <Fragment key={item.key}>
          {i > 0 && <><span className="cat-index-sep" aria-hidden="true">/</span><wbr /></>}
          <PageLink to={item.key === 'all' ? '/projects/' : `/projects/${item.key}/`} exact={item.key === 'all'} current={item.key === current}>
            {editing && item.key !== 'all' ? <span data-el={`cat-${item.key}`} data-edit={`category:${item.key}`} data-shared="">{renamed[item.key] ?? item.name}</span> : item.name}
          </PageLink>
        </Fragment>
      ))}
    </nav>
  )
}
