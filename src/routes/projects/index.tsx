import { createFileRoute } from '@tanstack/react-router'
import CategoryIndex from '#/components/category-index'
import ProjectRow from '#/components/project-row'
import { projects, site } from '#/lib/site'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/projects/')({ component: Projects })

function Projects() {
  useTitle('Projects')
  return (
    <main className="listing">
      <section className="listing-head">
        <h1 className="c listing-title">Projects</h1>
        {site.projects_intro && <p className="listing-intro">{site.projects_intro}</p>}
        <CategoryIndex used={new Set(projects.map((p) => p.category))} />
      </section>
      <section className="rows">{projects.map((p) => <ProjectRow key={p.slug} p={p} />)}</section>
    </main>
  )
}
