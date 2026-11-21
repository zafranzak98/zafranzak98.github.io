import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import CategoryIndex from '#/components/category-index'
import ProjectBand, { ListedProjects } from '#/components/project-band'
import { categories, categoryBySlug, projects, projectsIn } from '#/lib/site'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/projects/$projectCat/')({
  loader: ({ params }) => {
    const category = categoryBySlug(params.projectCat)
    const list = projectsIn(params.projectCat)
    if (!category || !list.length) throw notFound()
    return { category, list }
  },
  component: CategoryPage,
})

function CategoryPage() {
  const { category, list } = Route.useLoaderData()
  useTitle(category.name)
  const full = list.filter((p) => p.page_type === 'Full case study')
  const used = new Set(projects.map((p) => p.category))
  const others = categories.filter((c) => c.slug !== category.slug && used.has(c.slug))
  return (
    <main className="listing listing-cat">
      <section className="listing-head">
        <Link to="/projects" className="back">← All projects</Link>
        <span className="lab cat-count">Category · {list.length} {list.length === 1 ? 'project' : 'projects'}</span>
        <h1 className="c listing-title cat-title">{category.name}</h1>
        {category.intro && <p className="listing-intro">{category.intro}</p>}
        <CategoryIndex used={used} />
      </section>
      <section className="bands">{full.map((p, i) => <ProjectBand key={p.slug} p={p} number={i + 1} />)}</section>
      <ListedProjects items={list.filter((p) => p.page_type !== 'Full case study')} startAt={full.length + 1} />
      {others.length > 0 && (
        <section className="others d-only">
          <span className="lab">Other categories</span>
          <div className="others-list">
            {others.map((c) => (
              <Link key={c.slug} to="/projects/$projectCat" params={{ projectCat: c.slug }}>
                <b className="c">{c.name}</b>
                <span>{c.intro} →</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
