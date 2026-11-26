import { createUsePuck, type Config, type Data } from '@puckeditor/core'
import { useMemo, type ReactNode } from 'react'
import Footer from '#/components/footer'
import Header from '#/components/header'
import { CategoryNames } from '#/components/category-index'
import * as pageBlocks from '#/layout/page-blocks'
import { Editing } from '#/layout/elements'
import { PageWords, aboutWords, categoryWords, footerWords, headerWords, homeWords, projectsWords } from '#/lib/page-words'
import { categories, projects, type Project } from '#/lib/site'
import { block, editorConfig, elementsField } from './config'
import { CATEGORY_FIELD, applyEdits, categoryEdits, useCanvasEditing, type Edits } from './elements'
import { SharedAround, sharedEdits } from './shared'
import { ClockSettings, wordsWithEdits } from './page-settings'

// Demo only (the visual editor demo): every page of the website in one list. A case study keeps
// its own editor (config.tsx); every other page is described here: its name, its words, its
// sections in their standard order, and the frame the website draws around them.

export type PageDef = {
  key: string
  label: string
  group: 'Pages' | 'Categories' | 'Shared'
  words: Record<string, unknown>
  sections: readonly string[]
  frame: (children: ReactNode) => ReactNode
  shared?: 'header' | 'footer'
}

const used = new Set(projects.map((p) => p.category))
export const PAGES: PageDef[] = [
  { key: 'home', label: 'Homepage', group: 'Pages', words: homeWords(), sections: pageBlocks.HOME_SECTIONS, frame: (c) => <pageBlocks.HomeFrame>{c}</pageBlocks.HomeFrame> },
  { key: 'about', label: 'About', group: 'Pages', words: aboutWords() as never, sections: pageBlocks.ABOUT_SECTIONS, frame: (c) => <pageBlocks.AboutFrame>{c}</pageBlocks.AboutFrame> },
  { key: 'projects', label: 'Projects (all)', group: 'Pages', words: projectsWords(), sections: pageBlocks.LISTING_SECTIONS, frame: (c) => <pageBlocks.ListingFrame>{c}</pageBlocks.ListingFrame> },
  ...categories.filter((c) => used.has(c.slug)).map((c): PageDef => ({
    key: `category:${c.slug}`, label: c.name, group: 'Categories', words: categoryWords(c.slug), sections: pageBlocks.LISTING_SECTIONS,
    frame: (children) => <pageBlocks.ListingFrame category={c.slug}>{children}</pageBlocks.ListingFrame>,
  })),
  { key: 'header', label: 'Header', group: 'Shared', words: headerWords(), sections: ['Header'], shared: 'header', frame: (c) => <>{c}<SharedNote part="header" /></> },
  { key: 'footer', label: 'Footer', group: 'Shared', words: footerWords(), sections: ['Footer'], shared: 'footer', frame: (c) => <><SharedNote part="footer" />{c}</> },
]
export const pageFor = (key: string | null) => PAGES.find((x) => x.key === key)

// The page's words stand in for a project wherever the editor reads or writes words.
// The page's own words keep their own title (the Projects page's "Projects", the footer's "Let's talk").
export const asProject = (page: PageDef) => ({ ...page.words, slug: `page-${page.key.replace(':', '-')}` }) as unknown as Project

export function standardLayout(page: PageDef): Data {
  return { root: { props: page.shared ? { edits: sharedEdits(page.shared) } : {} }, content: page.sections.map((type) => ({ type, props: { id: `${type}-standard` } })) } as Data
}

function SharedNote({ part }: { part: 'header' | 'footer' }) {
  return (
    <div className="shared-note" role="note">
      <b>Shared {part}.</b> One copy, shown on every page: Homepage, About, Projects, every category and every case study. A change here reaches all of them when published.
    </div>
  )
}

const NAMES: Record<string, string> = {
  HomeIntro: 'Introduction', HomeClock: 'Clock', HomeLine: 'Availability and CV', HomeFocus: 'Areas of Focus', HomeWork: 'Selected Projects',
  AboutHero: 'Title and portrait', AboutIntro: 'Intro', AboutSkills: 'Skills', AboutEducation: 'Education', AboutExperience: 'Experience',
  ListingHead: 'Title and categories', ListingBands: 'Project list', Header: 'Header', Footer: 'Footer',
}

const usePuck = createUsePuck()
export function pageConfig(page: PageDef): Config {
  const p = asProject(page)
  const base = editorConfig(p)
  const free = Object.fromEntries(['Text', 'Image', 'Grid', 'Cell', 'Spacer'].map((k) => [k, base.components[k]]))
  const category = page.key.startsWith('category:') ? page.key.slice(9) : undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const render = (type: string): ((props: any) => ReactNode) => {
    if (type === 'Header') return (props) => <Header elements={props.elements} />
    if (type === 'Footer') return (props) => <Footer elements={props.elements} />
    const Section = (pageBlocks as Record<string, unknown>)[type] as (props: object) => ReactNode
    return (props) => <Section {...props} category={category} />
  }
  // The homepage clock's settings show in Settings when its section is chosen (and when its line is).
// Here they sit in the panel's own frame; the line under the time is changed on the page or with the
// clock part, so it is not offered twice.
  const extra = (type: string) => (type === 'HomeClock' ? { clock: { type: 'custom', label: 'Clock settings', render: () => <div className="el-panel ps-section"><ClockSettings p={p} withLine={false} /></div> } } : {})
  const sections = Object.fromEntries(page.sections.map((type) => [type, block(NAMES[type] ?? type, render(type), { fields: { elements: elementsField(p), ...extra(type) } })]))
  return {
    root: { fields: {}, render: ({ children, edits }: { children: ReactNode; edits?: Edits }) => <PageEditorFrame page={page} edits={edits ?? {}}>{children}</PageEditorFrame> },
    categories: {
      page: { title: 'Sections of this page', components: [...page.sections] },
      ...(page.shared ? {} : { free: { title: 'Your own blocks', components: ['Text', 'Image', 'Grid', 'Cell', 'Spacer'] } }),
    },
    components: { ...sections, ...(page.shared ? {} : free) },
  }
}

// The real page in the canvas: the shared header and footer as published, and this page's
// sections showing your unpublished words.
function PageEditorFrame({ page, edits, children }: { page: PageDef; edits: Edits; children: ReactNode }) {
  usePuck((s) => s.appState.data.content)
  const anchor = useCanvasEditing(page.words as never, edits)
  const words = useMemo(() => (page.shared ? (applyEdits(page.words as never, edits) as unknown as Record<string, unknown>) : wordsWithEdits(page.words as never, edits)), [page, edits])
  const renamed = Object.fromEntries(categoryEdits(edits).map(([field, to]) => [field.match(CATEGORY_FIELD)![1], to]))
  return (
    <Editing.Provider value={true}>
      <CategoryNames.Provider value={renamed}>
        <span ref={anchor} hidden />
        <PageWords.Provider value={words}>
          <SharedAround header={page.shared === 'header' ? (words as never) : undefined} footer={page.shared === 'footer' ? (words as never) : undefined} editing={page.shared}>
            {page.frame(children)}
          </SharedAround>
        </PageWords.Provider>
      </CategoryNames.Provider>
    </Editing.Provider>
  )
}
