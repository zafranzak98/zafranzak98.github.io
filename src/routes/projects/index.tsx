import { createFileRoute } from '@tanstack/react-router'
import { LISTING_SECTIONS, ListingFrame } from '#/layout/page-blocks'
import { PageSections } from '#/layout/page-render'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/projects/')({ component: Projects })

function Projects() {
  useTitle('Projects')
  return (
    <ListingFrame>
      <PageSections page="projects" standard={LISTING_SECTIONS} />
    </ListingFrame>
  )
}
