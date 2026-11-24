import { createFileRoute } from '@tanstack/react-router'
import { AboutEducation, AboutExperience, AboutFrame, AboutHero, AboutIntro, AboutSkills } from '#/layout/page-blocks'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/about')({ component: About })

// The About page's sections (src/layout/page-blocks.tsx), in their standard order. The visual
// editor uses the same sections.
function About() {
  useTitle('About')
  return (
    <AboutFrame>
      <AboutHero />
      <AboutIntro />
      <AboutSkills />
      <AboutEducation />
      <AboutExperience />
    </AboutFrame>
  )
}
