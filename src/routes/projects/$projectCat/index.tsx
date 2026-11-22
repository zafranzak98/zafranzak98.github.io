import { createFileRoute, notFound } from '@tanstack/react-router'
import CategoryIndex from '#/components/category-index'
import { ProjectBands } from '#/components/project-band'
import { categoryBySlug, projectsIn } from '#/lib/site'
import { useTitle } from '#/lib/title'
import { Rich } from '#/components/rich'

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
  return (
    <main id="main" className="listing listing-cat">
      <section className="listing-head">
        <span className="lab cat-count">Category · {list.length} {list.length === 1 ? 'project' : 'projects'}</span>
        <h1 className="c listing-title cat-title">{category.name}</h1>
        {category.intro && <p className="listing-intro"><Rich text={category.intro} /></p>}
        <CategoryIndex />
      </section>
      <ProjectBands items={list} />
    </main>
  )
}
