import { createContext, useContext, type CSSProperties } from 'react'
import { COLOURS, type Colour } from './design'

// Settings for single elements inside a block (a heading, a figure, a label, an image), chosen in
// the design editor. Each screen size has its own values; Tablet follows Desktop and Phone follows
// Tablet unless set. Sizes match the site's own breakpoints: Phone up to 899px, Tablet 900 to 1279px.

export const SCREENS = ['desktop', 'tablet', 'phone'] as const
export type Screen = (typeof SCREENS)[number]

export const TEXT_SIZES = {
  meta: ['Label', 'var(--t-meta)'],
  small: ['Small', 'var(--t-small)'],
  body: ['Body', 'var(--t-body)'],
  lead: ['Lead', 'var(--t-lead)'],
  statement: ['Statement', 'var(--t-statement)'],
  h3: ['Sub-heading', 'var(--h3)'],
  h2: ['Heading', 'var(--h2)'],
  d2: ['Title', 'var(--d2)'],
  d1: ['Display', 'var(--d1)'],
} as const
export type TextSize = keyof typeof TEXT_SIZES

export type ElementLook = {
  x?: number // rem; moves the element without moving anything around it
  y?: number
  above?: number // rem of space above and below; these do move what follows
  below?: number
  align?: 'left' | 'center' | 'right'
  size?: TextSize
  weight?: 400 | 500 | 600 | 700
  colour?: Colour
  width?: number // per cent of the space it sits in (images)
  focusX?: number // crop focus in per cent (images)
  focusY?: number
  rotate?: number // degrees (images); replaces a cover's designed tilt, otherwise turns the whole part
  place?: Place // where the whole box sits in its area (start, centre, end), apart from its text alignment
  hidden?: boolean // left out at this screen size (and smaller ones, unless shown there)
  cover?: CoverSize // a project's opening cover: a step on the grid, so the text beside it reflows
  // A photo on a project page (placed in the website editor), presented without changing the file:
  span?: PhotoSpan // the space it can fill: Narrow, Text column, Wide or Full (phones: full unless set there)
  shape?: PhotoShape // its frame: its own shape or a fixed one; set once for every screen size
  fit?: 'cover' | 'contain' // in a frame of a fixed shape: fill it (cropped) or show the whole photo
}
export const PHOTO_SPANS = ['narrow', 'text', 'wide', 'full'] as const
export type PhotoSpan = (typeof PHOTO_SPANS)[number]
export const PHOTO_SHAPES = ['auto', '1/1', '4/5', '3/4', '16/9'] as const
export type PhotoShape = (typeof PHOTO_SHAPES)[number]
export const PLACES = ['start', 'center', 'end'] as const
export type Place = (typeof PLACES)[number]
export const COVER_SIZES = ['small', 'standard', 'large', 'xl'] as const
export type CoverSize = (typeof COVER_SIZES)[number]
export const COVER_NAMES: Record<CoverSize, string> = { small: 'Small', standard: 'Standard', large: 'Large', xl: 'Extra large' }
export type ElementStyle = Partial<Record<Screen, ElementLook>>
export type Elements = Record<string, ElementStyle>

const COLOUR_VAR: Record<Colour, string> = { Olive: 'var(--olive)', Sage: 'var(--sage)', 'Light sage': 'var(--lsage)', 'Off-white': 'var(--off)', Terracotta: 'var(--terra)' }
const SHORT: Record<Screen, string> = { desktop: 'd', tablet: 't', phone: 'p' }

// What a look turns into: one class and one CSS variable per setting and screen size.
function cssFor(look: ElementLook): [string, string][] {
  const out: [string, string][] = []
  if (look.x !== undefined) out.push(['x', `${look.x}rem`])
  if (look.y !== undefined) out.push(['y', `${look.y}rem`])
  if (look.above !== undefined) out.push(['above', `${look.above}rem`])
  if (look.below !== undefined) out.push(['below', `${look.below}rem`])
  if (look.align) out.push(['align', look.align])
  if (look.size) out.push(['size', TEXT_SIZES[look.size][1]])
  if (look.weight) out.push(['weight', String(look.weight)])
  if (look.colour && COLOURS.includes(look.colour)) out.push(['colour', COLOUR_VAR[look.colour]])
  if (look.width) out.push(['width', `${look.width}%`])
  if (look.rotate !== undefined && Number.isFinite(look.rotate)) out.push(['rotate', `${look.rotate}deg`])
  if (look.focusX !== undefined || look.focusY !== undefined) out.push(['focus', `${look.focusX ?? 50}% ${look.focusY ?? 50}%`])
  if (look.shape && PHOTO_SHAPES.includes(look.shape)) out.push(['shape', look.shape])
  if (look.fit === 'contain' || look.fit === 'cover') out.push(['fit', look.fit])
  return out
}

// In the design editor every element is marked so it can be clicked; on the website it is not,
// so an element without settings keeps exactly the markup it always had.
export const Editing = createContext(false)

export type ElementOptions = { className?: string; style?: CSSProperties; field?: string; rich?: boolean; breaks?: boolean }

export function useElement(elements: Elements | undefined) {
  const editing = useContext(Editing)
  return (key: string, { className, style, field, rich, breaks }: ElementOptions = {}) => {
    const classes = className ? [className] : []
    const vars: Record<string, string> = {}
    // Hidden at a size: the website leaves it out there; the editor shows it faded, so it can be shown again.
    const hiddenAt = SCREENS.filter((screen) => lookAt(elements?.[key], screen).hidden)
    if (!editing) for (const screen of hiddenAt) classes.push(`el-hidden-${SHORT[screen]}`)
    for (const screen of SCREENS) {
      const cover = elements?.[key]?.[screen]?.cover
      if (cover && COVER_SIZES.includes(cover)) classes.push(`el-cover-${SHORT[screen]}-${cover}`)
      const place = elements?.[key]?.[screen]?.place
      if (place && PLACES.includes(place)) classes.push(`el-place-${SHORT[screen]}-${place}`)
      const span = elements?.[key]?.[screen]?.span
      if (span && PHOTO_SPANS.includes(span)) classes.push(`el-span-${SHORT[screen]}-${span}`)
      for (const [name, value] of cssFor(elements?.[key]?.[screen] ?? {})) {
        classes.push(`el-${name}-${SHORT[screen]}`)
        vars[`--el-${name}-${SHORT[screen]}`] = value
      }
    }
    const merged = { ...style, ...vars } as CSSProperties
    return {
      className: classes.length ? classes.join(' ') : undefined,
      style: Object.keys(merged).length ? merged : undefined,
      ...(editing && { 'data-el': key, ...(field && { 'data-edit': field }), ...(field && rich && { 'data-rich': '' }), ...(field && rich && breaks && { 'data-breaks': '' }), ...(hiddenAt.length && { 'data-el-hidden': hiddenAt.map((s) => SHORT[s]).join(' ') }) }),
    }
  }
}

// The same look for a second copy of an element's words (shown on phones only, say), without the
// editor's markers, so the editor still has one part to choose.
export const lookOnly = ({ className, style }: { className?: string; style?: CSSProperties }) => ({ className, style })

// The value an element shows at a screen size, following the larger sizes when not set there.
export function lookAt(style: ElementStyle | undefined, screen: Screen): ElementLook {
  const order = SCREENS.slice(0, SCREENS.indexOf(screen) + 1)
  return Object.assign({}, ...order.map((s) => style?.[s] ?? {}))
}
