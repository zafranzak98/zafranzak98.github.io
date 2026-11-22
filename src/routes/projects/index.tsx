import { createFileRoute } from '@tanstack/react-router'
import CategoryIndex from '#/components/category-index'
import { ProjectBands } from '#/components/project-band'
import { projects, site } from '#/lib/site'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/projects/')({ component: Projects })

function Projects() {
  useTitle('Projects')
  return (
    <main id="main" className="listing">
      <section className="listing-head">
        <h1 className="c listing-title">Projects</h1>
        {site.projects_intro && <p className="listing-intro">{site.projects_intro}</p>}
        <CategoryIndex />
      </section>
      <ProjectBands items={projects} />
    </main>
  )
}
