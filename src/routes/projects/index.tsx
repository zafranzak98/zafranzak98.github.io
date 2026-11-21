import { createFileRoute } from '@tanstack/react-router'
import CategoryIndex from '#/components/category-index'
import ProjectBand, { ListedProjects } from '#/components/project-band'
import { caseStudies, projects, site } from '#/lib/site'
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
      <section className="bands">{caseStudies.map((p, i) => <ProjectBand key={p.slug} p={p} number={i + 1} />)}</section>
      <ListedProjects items={projects.filter((p) => p.page_type !== 'Full case study')} startAt={caseStudies.length + 1} />
    </main>
  )
}
