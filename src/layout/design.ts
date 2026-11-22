import type { CSSProperties } from 'react'

// Design settings a block can carry, chosen in the design editor. Every value is optional:
// a block with no settings renders exactly as the site's own styles define it.
// Values come from the site's existing palette, spacing and type scale, so choices stay
// within the approved design while still covering colour, spacing, position, size and layout.

export const COLOURS = ['Olive', 'Sage', 'Light sage', 'Off-white', 'Terracotta'] as const
export type Colour = (typeof COLOURS)[number]

const COLOUR_VAR: Record<Colour, string> = {
  Olive: 'var(--olive)',
  Sage: 'var(--sage)',
  'Light sage': 'var(--lsage)',
  'Off-white': 'var(--off)',
  Terracotta: 'var(--terra)',
}

// Measured contrast between palette colours (WCAG ratio), used for warnings in the editor.
const HEX: Record<Colour, string> = { Olive: '#484527', Sage: '#A3B18A', 'Light sage': '#CDD5BE', 'Off-white': '#EEF1ED', Terracotta: '#9A3F24' }
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a: Colour, b: Colour) => {
  const [x, y] = [luminance(HEX[a]), luminance(HEX[b])].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// Space above or below a block, in rem: the steps the site already uses between elements.
export const SPACES = ['0', '0.5', '1', '2', '3.5', '5.5'] as const
export type Space = (typeof SPACES)[number]

export type Design = {
  background?: Colour
  textColour?: Colour
  spaceAbove?: Space
  spaceBelow?: Space
  spaceAbovePhone?: Space
  spaceBelowPhone?: Space
  shiftX?: number // rem, desktop only; phones keep the block in place
  shiftY?: number
  align?: 'left' | 'center' | 'right'
  width?: 'full' | 'wide' | 'text' | 'narrow'
  textSize?: 'smaller' | 'larger' | 'largest'
  headingSize?: 'smaller' | 'larger' | 'largest'
  show?: 'desktop' | 'phone'
}

const SCALE = { smaller: 0.9, larger: 1.15, largest: 1.3 }
const TEXT_TOKENS: [string, string][] = [['--t-meta', '0.8125rem'], ['--t-small', '0.9375rem'], ['--t-body', '1rem'], ['--t-lead', '1.125rem'], ['--t-statement', '1.5rem']]
const HEADING_TOKENS: [string, string][] = [['--h2', '2.15rem'], ['--h3', '1.8rem'], ['--d2', 'min(7vw, 168px)'], ['--d1', 'min(9.4vw, 226px)']]

// The class names and inline style that apply a block's design settings. Empty when there are
// none, so an untouched block keeps exactly the markup it had before the editor existed.
export function designProps(d: Design | undefined, className = '', style: CSSProperties = {}) {
  if (!d || !(Object.values(d) as unknown[]).some((v) => v !== undefined && v !== '' && v !== 0)) return { className: className || undefined, style: Object.keys(style).length ? style : undefined }
  const classes = [className]
  const vars: Record<string, string> = {}
  const set = (cls: string, name: string, value: string) => { classes.push(cls); vars[name] = value }
  if (d.background) set('d-bg', '--d-bg', COLOUR_VAR[d.background])
  if (d.textColour) set('d-fg', '--d-fg', COLOUR_VAR[d.textColour])
  if (d.spaceAbove) set('d-pt', '--d-pt', `${d.spaceAbove}rem`)
  if (d.spaceBelow) set('d-pb', '--d-pb', `${d.spaceBelow}rem`)
  if (d.spaceAbovePhone) set('d-pt-m', '--d-pt-m', `${d.spaceAbovePhone}rem`)
  if (d.spaceBelowPhone) set('d-pb-m', '--d-pb-m', `${d.spaceBelowPhone}rem`)
  if (d.shiftX || d.shiftY) { classes.push('d-shift'); vars['--d-x'] = `${d.shiftX ?? 0}rem`; vars['--d-y'] = `${d.shiftY ?? 0}rem` }
  if (d.align) classes.push(`d-align-${d.align}`)
  if (d.width) classes.push(`d-w-${d.width}`)
  if (d.show) classes.push(`d-only-${d.show}`)
  for (const [kind, tokens] of [[d.textSize, TEXT_TOKENS], [d.headingSize, HEADING_TOKENS]] as const)
    if (kind) for (const [name, base] of tokens) vars[name] = `calc(${base} * ${SCALE[kind]})`
  return { className: [...new Set(classes.filter(Boolean))].join(' '), style: { ...style, ...vars } as CSSProperties }
}

// Plain-language warnings shown on a block while editing; they never block a save.
export function designWarnings(d: Design | undefined, defaultText: Colour = 'Olive', defaultBg: Colour = 'Off-white') {
  if (!d?.textColour && !d?.background) return []
  const fg = d.textColour ?? defaultText
  const bg = d.background ?? defaultBg
  const ratio = contrast(fg, bg)
  if (fg === bg) return [`Text and background are both ${fg}: the text cannot be seen.`]
  if (ratio < 4.5) return [`${fg} text on ${bg} measures ${ratio.toFixed(2)}:1. Small text needs 4.5:1 to be readable for everyone; large headings need 3:1.`]
  return []
}
