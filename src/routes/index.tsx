import { createFileRoute } from '@tanstack/react-router'
import { HOME_SECTIONS, HomeFrame } from '#/layout/page-blocks'
import { PageSections } from '#/layout/page-render'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/')({ component: Home })

// The homepage's sections as published from the visual editor, or in their standard order.
function Home() {
  useTitle()
  return (
    <HomeFrame>
      <PageSections page="home" standard={HOME_SECTIONS} />
    </HomeFrame>
  )
}
