import { createFileRoute } from '@tanstack/react-router'
import { ListingBands, ListingFrame, ListingHead } from '#/layout/page-blocks'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/projects/')({ component: Projects })

function Projects() {
  useTitle('Projects')
  return (
    <ListingFrame>
      <ListingHead />
      <ListingBands />
    </ListingFrame>
  )
}
