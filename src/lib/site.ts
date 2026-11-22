import { about, allCategories, allProjects, site } from '../../.content-collections/generated'
import { assignColours } from './project-colours.js'
import { isPhoto, variantPath, widthsFor } from './image-variants.js'
import imageWidths from 'virtual:image-widths'

export { about, site }
export type Project = (typeof allProjects)[number]
export type Category = (typeof allCategories)[number]
export type Img = { image?: string; alt?: string; caption?: string }

const byOrder = <T extends { order?: number; title?: string; name?: string }>(a: T, b: T) =>
  (a.order ?? 999) - (b.order ?? 999) || (a.title ?? a.name ?? '').localeCompare(b.title ?? b.name ?? '')

export const categories: Category[] = [...allCategories].sort(byOrder)
export const projects: Project[] = [...allProjects].sort(byOrder)
export const caseStudies = projects.filter((p) => p.page_type === 'Full case study')

export const categoryBySlug = (slug: string) => categories.find((c) => c.slug === slug)
export const projectsIn = (slug: string) => projects.filter((p) => p.category === slug)
// Finds a case study by its web address (the last part of its URL), not its file name.
export const projectByAddress = (address: string) => caseStudies.find((p) => p.address === address)
export const categoryName = (slug: string) => categoryBySlug(slug)?.name ?? slug
export const yearOf = (p: Project) => (p.year ? String(p.year) : p.when)

// Opening colours, used for a project's band on the Projects pages and its case study opening.
// Text and secondary text are chosen per background for contrast (WCAG AA, measured):
// Olive 8.57 / 6.43, Off-white 8.57 / 5.94, Light sage 6.43 / 6.43, Terracotta 5.94 / 5.94.
// Sage tops out at 4.27 with olive, the strongest text colour in the palette on it.
export const OPENING: Record<Project['opening_colour'], { bg: string; fg: string; sub: string }> = {
  Olive: { bg: 'var(--olive)', fg: 'var(--off)', sub: 'var(--lsage)' },
  Sage: { bg: 'var(--sage)', fg: 'var(--olive)', sub: 'var(--olive)' },
  'Light sage': { bg: 'var(--lsage)', fg: 'var(--olive)', sub: 'var(--olive)' },
  'Off-white': { bg: 'var(--off)', fg: 'var(--olive)', sub: 'var(--terra)' },
  Terracotta: { bg: 'var(--terra)', fg: 'var(--off)', sub: 'var(--off)' },
}

// Each project's final colour: its Opening colour unless that would clash with a neighbouring
// project on the All or category pages (see project-colours.js). Same colour on every page.
const colours = assignColours(projects)
export const colourOf = (p: Project) => colours.get(p.slug) ?? p.opening_colour
export const openingOf = (p: Project) => OPENING[colourOf(p)]

// The address a file in /public is served from. Keeps working if the site ever sits in a sub-folder.
export const asset = (path?: string) => (path ? import.meta.env.BASE_URL.replace(/\/$/, '') + path : undefined)

// The original photo's size in pixels. With a srcset the browser no longer treats the photo's
// own pixel size as its natural size, so images whose size depends on it (the gallery, and
// images shown at their own proportions) use this instead. Undefined outside the built site.
export const photoSize = (path?: string) => {
  const size = path && import.meta.env.PROD ? imageWidths[path] : undefined
  return size ? { width: size[0], height: size[1] } : undefined
}

// A photo cropped to fill a frame of another shape (object-fit: cover) needs more pixels than the
// frame's width: a wide photo in a tall frame is shown at the frame's height. frameRatio is the
// frame's width / height; the sizes values grow by how much wider the photo is than the frame.
export const croppedSizes = (sizes: string, path?: string, frameRatio?: number) => {
  const size = photoSize(path)
  if (!size || !frameRatio) return sizes
  const factor = size.width / size.height / frameRatio
  if (factor <= 1.01) return sizes
  return sizes
    .split(',')
    .map((entry) => entry.trim().replace(/(\S+)$/, (value) => `calc(${value} * ${factor.toFixed(3)})`))
    .join(', ')
}

// Everything an <img> needs to load a photo at the right size. `sizes` says how wide the image is
// shown (for example "(max-width: 899px) 100vw, 26vw"); the browser then picks the smallest copy
// that stays sharp on that screen. Only in the built website, where the copies exist.
export const imageProps = (path?: string, sizes?: string) => {
  const src = asset(path)
  const width = path && import.meta.env.PROD && isPhoto(path) ? imageWidths[path]?.[0] : undefined
  if (!path || !width || !sizes) return { src }
  const srcSet = [...widthsFor(width).map((w) => `${asset(variantPath(path, w))} ${w}w`), `${src} ${width}w`].join(', ')
  return { src, srcSet, sizes }
}

export const mailto = `mailto:${site.email}`
export const cvUrl = asset(site.cv || undefined)
