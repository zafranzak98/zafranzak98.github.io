type Named = { title?: string; url?: string }

export const ADDRESS_PATTERN: RegExp
export function slugify(text: unknown): string
export function overrideOf(p: Named | undefined): string
export function addressOf(p: Named | undefined): string
export function pagePath(category: string, address: string): string
