import { createFileRoute } from '@tanstack/react-router'
import { HomeClock, HomeFocus, HomeFrame, HomeIntro, HomeLine, HomeWork } from '#/layout/page-blocks'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/')({ component: Home })

// The homepage's sections (src/layout/page-blocks.tsx), in their standard order. The visual
// editor uses the same sections.
function Home() {
  useTitle()
  return (
    <HomeFrame>
      <HomeIntro />
      <HomeClock />
      <HomeLine />
      <HomeFocus />
      <HomeWork />
    </HomeFrame>
  )
}
