import { createFileRoute, notFound } from '@tanstack/react-router'
import { LISTING_SECTIONS, ListingFrame } from '#/layout/page-blocks'
import { PageSections } from '#/layout/page-render'
import { categoryBySlug, projectsIn } from '#/lib/site'
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
  const { category } = Route.useLoaderData()
  useTitle(category.name)
  return (
    <ListingFrame category={category.slug}>
      <PageSections page={`category:${category.slug}`} standard={LISTING_SECTIONS} category={category.slug} />
    </ListingFrame>
  )
}
