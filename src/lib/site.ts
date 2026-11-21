import { about, allCategories, allProjects, site } from '../../.content-collections/generated'

export { about, site }
export type Project = (typeof allProjects)[number]
export type Category = (typeof allCategories)[number]
export type Img = { image?: string; alt?: string; caption?: string }

export const PREVIEW = import.meta.env.VITE_SITE_MODE === 'preview'

const byOrder = <T extends { order?: number; title?: string; name?: string }>(a: T, b: T) =>
  (a.order ?? 999) - (b.order ?? 999) || (a.title ?? a.name ?? '').localeCompare(b.title ?? b.name ?? '')

export const categories: Category[] = [...allCategories].sort(byOrder)
export const projects: Project[] = [...allProjects].sort(byOrder)
export const caseStudies = projects.filter((p) => p.page_type === 'Full case study')

export const categoryBySlug = (slug: string) => categories.find((c) => c.slug === slug)
export const projectsIn = (slug: string) => projects.filter((p) => p.category === slug)
export const projectBySlug = (slug: string) => caseStudies.find((p) => p.slug === slug)
export const categoryName = (slug: string) => categoryBySlug(slug)?.name ?? slug
export const yearOf = (p: Project) => (p.year ? String(p.year) : p.when)

// Opening colours: background, text and the small category line, all from the approved palette.
export const OPENING: Record<Project['opening_colour'], { bg: string; fg: string; sub: string }> = {
  Olive: { bg: 'var(--olive)', fg: 'var(--off)', sub: 'var(--sage)' },
  Sage: { bg: 'var(--sage)', fg: 'var(--olive)', sub: 'var(--olive)' },
  'Light sage': { bg: 'var(--lsage)', fg: 'var(--olive)', sub: 'var(--terra)' },
  'Off-white': { bg: 'var(--off)', fg: 'var(--olive)', sub: 'var(--terra)' },
  Terracotta: { bg: 'var(--terra)', fg: 'var(--off)', sub: 'var(--lsage)' },
  Ink: { bg: 'var(--ink)', fg: 'var(--off)', sub: 'var(--sage)' },
}

// The address a file in /public is served from. Keeps working if the site ever sits in a sub-folder.
export const asset = (path?: string) => (path ? import.meta.env.BASE_URL.replace(/\/$/, '') + path : undefined)

export const mailto = `mailto:${site.email}`
export const cvUrl = asset(site.cv || undefined)
