// Says in a few words what one step of undo or redo changes, by comparing the page before and after
// it: "move Summary line", "turn Opening image", "add a section". Used for the Undo and Redo labels
// and the short message after undoing. When the difference is unclear it says "the last change".
import { nameOf } from './elements'

type Look = Record<string, unknown>
type Item = { type: string; props: Record<string, unknown> & { id?: string; elements?: Record<string, Record<string, Look>> } }
type Page = { content?: Item[]; root?: { props?: Record<string, unknown> } }

const WHAT: [string[], string][] = [
  [['rotate'], 'turn'],
  [['x', 'y'], 'move'],
  [['width', 'cover'], 'resize'],
  [['hidden'], 'show or hide'],
  [['above', 'below'], 'change the spacing of'],
  [['focusX', 'focusY'], 'change the crop of'],
  [['size', 'weight', 'colour', 'align', 'place'], 'restyle'],
]
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function describeStep(before: Page | undefined, after: Page | undefined): string {
  if (!before || !after) return 'the last change'
  const a = before.content ?? []
  const b = after.content ?? []
  if (a.length < b.length) return 'add a section'
  if (a.length > b.length) return 'remove a section'
  if (!same(a.map((i) => i.props.id), b.map((i) => i.props.id))) return 'rearrange sections'
  const parts: string[] = []
  let verb = ''
  for (let i = 0; i < a.length; i++) {
    if (same(a[i], b[i])) continue
    const ea = a[i].props.elements ?? {}
    const eb = b[i].props.elements ?? {}
    for (const key of new Set([...Object.keys(ea), ...Object.keys(eb)])) {
      if (same(ea[key], eb[key])) continue
      parts.push(key)
      const changed = new Set<string>()
      for (const screen of new Set([...Object.keys(ea[key] ?? {}), ...Object.keys(eb[key] ?? {})])) {
        const la = ea[key]?.[screen] ?? {}
        const lb = eb[key]?.[screen] ?? {}
        for (const k of new Set([...Object.keys(la), ...Object.keys(lb)])) if (!same(la[k], lb[k])) changed.add(k)
      }
      verb ||= WHAT.find(([keys]) => keys.some((k) => changed.has(k)))?.[1] ?? 'change'
    }
    if (!parts.length) {
      const { elements: _a, ...pa } = a[i].props
      const { elements: _b, ...pb } = b[i].props
      if (!same(pa, pb)) return 'edit the words'
    }
  }
  if (parts.length === 1) return `${verb} ${nameOf(parts[0])}`
  if (parts.length > 1) return `change ${parts.length} parts`
  const ra = before.root?.props ?? {}
  const rb = after.root?.props ?? {}
  if (!same(ra.intended, rb.intended)) return 'a layout note marked as intended'
  if (!same(ra.edits, rb.edits)) return 'rename a category'
  return 'the last change'
}
