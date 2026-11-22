type Colour = 'Olive' | 'Sage' | 'Light sage' | 'Off-white' | 'Terracotta'
type Listed = { slug: string; category: string; page_type: string; opening_colour: string; colour_choice?: string; order?: number; year?: number; title?: string }

export const PALETTE: Colour[]
export const FOOTER: Colour
export function tooSimilar(a: string, b: string): boolean
export function bandOrder<T extends Listed>(projects: T[]): T[]
export function allOrder<T extends Listed>(projects: T[]): T[]
export function listings<T extends Listed>(projects: T[]): { name: string; items: T[] }[]
export function assignColours(projects: Listed[]): Map<string, Colour>
export function isFixed(p: { colour_choice?: string }): boolean
export function colourWarnings(projects: Listed[], colours: Map<string, Colour>, nameOf?: (slug: string) => string): { slugs: string[]; text: string }[]
