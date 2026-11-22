import { useEffect, useMemo, useState, type ReactNode } from 'react'
import savedLayouts from 'virtual:layouts'
import type { Project } from '#/lib/site'
import * as caseBlocks from './case-blocks'
import { Case, SECTION_BLOCKS, SECTIONS, isFilled } from './case-blocks'
import { freeBlocks } from './free-blocks'

// Page layouts. A layout is the list of blocks on a page, in order, with each block's settings:
// the same data the design editor saves (content/layouts/<project file name>.json). A project
// with no saved layout uses the standard one, which reproduces the approved template exactly.
// The website draws layouts itself, without loading the editor, so visitors download nothing extra.

export type Item = { type: string; props: Record<string, unknown> & { id: string } }
export type Layout = { root: { props?: Record<string, unknown> }; content: Item[] }

const blocks: Record<string, (props: Record<string, unknown>) => ReactNode> = {
  CategoryNav: caseBlocks.CategoryNav as never,
  Opening: caseBlocks.Opening as never,
  Facts: caseBlocks.Facts as never,
  SectionNav: caseBlocks.SectionNav as never,
  Gap: caseBlocks.Gap as never,
  Overview: caseBlocks.Overview as never,
  Research: caseBlocks.Research as never,
  Work: caseBlocks.Work as never,
  Outcomes: caseBlocks.Outcomes as never,
  AlsoIn: caseBlocks.AlsoIn as never,
  PrevNext: caseBlocks.PrevNext as never,
  ...freeBlocks,
}

export function RenderItems({ items }: { items: Item[] }) {
  return items.map((item) => {
    const Block = blocks[item.type]
    return Block ? <Block key={item.props.id} {...item.props} /> : null
  })
}

// The standard case study layout: today's template, block for block.
export const STANDARD_CASE: string[] = ['CategoryNav', 'Opening', 'Facts', 'SectionNav', 'Gap', 'Overview', 'Research', 'Work', 'Outcomes', 'AlsoIn', 'PrevNext']
export const standardCaseLayout = (): Layout => ({
  root: { props: {} },
  content: STANDARD_CASE.map((type) => ({ type, props: { id: `${type}-standard` } })),
})

export const savedLayoutFor = (p: Project): Layout | undefined => (savedLayouts as Record<string, Layout>)[p.slug]
export const caseLayoutFor = (p: Project): Layout => savedLayoutFor(p) ?? standardCaseLayout()

// The numbered sections in the order the layout places them, leaving out empty ones.
export const shownSections = (content: Item[], p: Project) =>
  content.map((i) => SECTION_BLOCKS[i.type]).filter((id): id is string => Boolean(id) && isFilled(p, id))

// Wraps a case study's blocks: the page element, and what the blocks share. Also highlights the
// section on screen in the sticky section bar.
export function CaseFrame({ p, content, children }: { p: Project; content: Item[]; children: ReactNode }) {
  const shown = useMemo(() => shownSections(content, p), [content, p])
  const [active, setActive] = useState<string>(shown[0] ?? '')
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-30% 0px -60% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [p.slug, shown])
  return (
    <Case.Provider value={{ p, shown, active }}>
      <main id="main" className={`case case-${p.design ?? 'standard'}`}>{children}</main>
    </Case.Provider>
  )
}

export function CasePage({ p }: { p: Project }) {
  const layout = caseLayoutFor(p)
  return (
    <CaseFrame p={p} content={layout.content}>
      <RenderItems items={layout.content} />
    </CaseFrame>
  )
}
