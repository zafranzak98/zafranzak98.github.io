type Colour = 'Olive' | 'Sage' | 'Light sage' | 'Off-white' | 'Terracotta'
type Listed = { slug: string; category: string; page_type: string; opening_colour: string; order?: number; title?: string }

export const PALETTE: Colour[]
export const FOOTER: Colour
export function tooSimilar(a: string, b: string): boolean
export function bandOrder<T extends Listed>(projects: T[]): T[]
export function listings<T extends Listed>(projects: T[]): { name: string; items: T[] }[]
export function assignColours(projects: Listed[]): Map<string, Colour>
