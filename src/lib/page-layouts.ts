import savedLayouts from 'virtual:layouts'

// Saved visual-editor layouts of the website's pages (content/layouts/page-<key>.json), shared by
// the website and the editor. A page's layout holds its sections in order with their settings, and
// `root.props.words`: every word change published from the editor. Words that also live in a content
// file the website editor (/admin) edits are written to that file when publishing; the layout keeps
// them only as a record, so Versions can bring them back. The other words (header, footer, labels)
// live only in the layout, and the website reads them from there.

export type Edits = Record<string, string>
export type PageItem = { type: string; props: Record<string, unknown> & { id: string } }
export type PageLayout = { root: { props?: { words?: Edits } & Record<string, unknown> }; content: PageItem[] }

export const pageSlug = (key: string) => `page-${key.replace(':', '-')}`
export const savedPage = (key: string): PageLayout | undefined => (savedLayouts as Record<string, PageLayout>)[pageSlug(key)]

// Where a page's word is kept when it also lives in a content file: the file and the field in it.
// Category names (category:<slug>) are handled with the category files, as on case studies.
const ABOUT = /^(intro|intro_more|portrait_caption|languages:\d+|portrait:(image|alt)|(skills|experience):\d+:[a-z_]+|education:[^:]+:[a-z_]+)$/
const HOME = /^(home_intro|home_byline|availability|areas_of_focus:\d+:label|clock:(city|time_zone|line|show|weather))$/
export function fileTarget(key: string, field: string): { path: string; field: string } | null {
  if (key === 'home' && HOME.test(field)) return { path: 'content/site.yml', field }
  if (key === 'projects' && field === 'intro') return { path: 'content/site.yml', field: 'projects_intro' }
  if (key === 'about' && ABOUT.test(field)) return { path: 'content/about.md', field }
  const category = key.match(/^category:(.+)$/)
  if (category && field === 'intro') return { path: `content/categories/${category[1]}.md`, field: 'intro' }
  return null
}
export const ownField = (key: string, field: string) => !fileTarget(key, field) && !/^category:/.test(field)

const keysOf = (field: string) => field.split(':').map((k) => (/^\d+$/.test(k) ? Number(k) : k))

// The words the page shows: its standard words with the words kept only in its published layout.
export function withOwnWords<T>(key: string, words: T): T {
  const saved = savedPage(key)?.root.props?.words
  if (!saved) return words
  const own = Object.entries(saved).filter(([field]) => ownField(key, field))
  if (!own.length) return words
  const copy = structuredClone(words) as Record<string | number, unknown>
  for (const [field, value] of own) {
    const path = keysOf(field)
    let target = copy
    for (const k of path.slice(0, -1)) target = (target[k] ??= {}) as Record<string | number, unknown>
    target[path[path.length - 1]] = value
  }
  return copy as T
}

// The settings of the shared header's or footer's single section, as published.
export const sharedElements = (part: 'header' | 'footer') => savedPage(part)?.content.find((i) => i.type === (part === 'header' ? 'Header' : 'Footer'))?.props.elements as never
