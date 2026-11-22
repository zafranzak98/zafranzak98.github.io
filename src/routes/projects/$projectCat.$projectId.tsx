import { createFileRoute, notFound } from '@tanstack/react-router'
import { CasePage } from '#/layout/render'
import { projectByAddress } from '#/lib/site'
import { useTitle } from '#/lib/title'

// A case study page. Its blocks and their order come from the project's saved design-editor
// layout, or the standard layout when it has none (src/layout/render.tsx).
export const Route = createFileRoute('/projects/$projectCat/$projectId')({
  loader: ({ params }) => {
    const project = projectByAddress(params.projectId)
    if (!project || project.category !== params.projectCat) throw notFound()
    return { project }
  },
  component: CaseStudy,
})

function CaseStudy() {
  const { project: p } = Route.useLoaderData()
  useTitle(p.seo?.title ?? p.title)
  return <CasePage key={p.slug} p={p} />
}
