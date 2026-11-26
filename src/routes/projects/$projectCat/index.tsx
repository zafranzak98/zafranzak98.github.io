import { createFileRoute, notFound } from '@tanstack/react-router'
import { ListingBands, ListingFrame, ListingHead } from '#/layout/page-blocks'
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
      <ListingHead category={category.slug} />
      <ListingBands category={category.slug} />
    </ListingFrame>
  )
}
