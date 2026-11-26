import type { Data } from '@puckeditor/core'
import { nameOf, type Edits } from './elements'

// Visual editor demo: the safeguard for the same words changed in two places, simulated in this
// browser. The real editor (github.ts) compares each changed word field with what the editor started
// from and refuses to publish when the website editor changed the same field since; unrelated fields
// merge. Here "someone else" is a simulated edit kept in this browser; nothing is sent anywhere.

export type Clash = { field: string; mine: string; theirs: string }

const REMOTE = (slug: string) => `uve-demo:remote:${slug}`
type Remote = { edits: Edits; at: string }
export const readRemote = (slug: string): Remote | null => { try { return JSON.parse(localStorage.getItem(REMOTE(slug)) ?? 'null') as Remote | null } catch { return null } }
export const writeRemote = (slug: string, r: Remote) => { try { localStorage.setItem(REMOTE(slug), JSON.stringify(r)) } catch { /* kept until the tab closes */ } }
export const clearRemote = (slug: string) => { try { localStorage.removeItem(REMOTE(slug)) } catch { /* nothing to remove */ } }

export const editsOf = (data: Data | null | undefined): Edits => ((data?.root?.props as { edits?: Edits } | undefined)?.edits) ?? {}

// Fields both sides changed, to different words.
export function clashes(mine: Edits, theirs: Edits): Clash[] {
  return Object.keys(theirs).filter((f) => f in mine && mine[f] !== theirs[f]).map((field) => ({ field, mine: mine[field], theirs: theirs[field] }))
}

const NAMED: Record<string, string> = {
  'clock:show': 'Show the clock', 'clock:weather': 'Show the weather', 'clock:city': 'Clock city', 'clock:time_zone': 'Clock time zone', 'clock:line': 'Line under the time',
  'portrait:image': 'Portrait photo', 'portrait:alt': 'Portrait description',
}
// A field's name as the editor shows it (the part on the page that shows it).
export function fieldName(field: string) {
  if (NAMED[field]) return NAMED[field]
  const doc = (document.getElementById('preview-frame') as HTMLIFrameElement | null)?.contentDocument
  const el = [...(doc?.querySelectorAll<HTMLElement>('[data-edit]') ?? [])].find((n) => n.dataset.edit === field)
  return el?.dataset.el ? nameOf(el.dataset.el) : field.replace(/[_:]/g, ' ')
}
// Shortened words for a message.
export const short = (words: string) => { const plain = words.replace(/[*_]/g, ''); return plain.length > 70 ? `${plain.slice(0, 67)}…` : plain }
