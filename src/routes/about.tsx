import { createFileRoute } from '@tanstack/react-router'
import { ABOUT_SECTIONS, AboutFrame } from '#/layout/page-blocks'
import { PageSections } from '#/layout/page-render'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/about')({ component: About })

// The About page's sections as published from the visual editor, or in their standard order.
function About() {
  useTitle('About')
  return (
    <AboutFrame>
      <PageSections page="about" standard={ABOUT_SECTIONS} />
    </AboutFrame>
  )
}
