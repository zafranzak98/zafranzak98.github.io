// Says in a few words what one step of undo or redo changes, by comparing the page before and after
// it: "move Summary line", "turn Opening image", "add a section". Used for the Undo and Redo labels
// and the short message after undoing. When the difference is unclear it says "the last change".
import { nameOf } from './elements'
import { kindName } from './sections'

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
  const ids = (l: Item[]) => l.map((i) => i.props.id)
  if (a.length < b.length) { const added = b.find((i) => !ids(a).includes(i.props.id)); return added ? `add ${kindName(added.type)}` : 'add a section' }
  if (a.length > b.length) { const gone = a.find((i) => !ids(b).includes(i.props.id)); return gone ? `remove ${kindName(gone.type)}` : 'remove a section' }
  if (!same(ids(a), ids(b))) {
    // The section that travelled furthest is the one moved; two neighbours swapping are named together.
    const shift = b.map((i, k) => ({ i, d: Math.abs(ids(a).indexOf(i.props.id) - k) })).filter((x) => x.d > 0).sort((x, y) => y.d - x.d)
    if (shift.length === 2 && shift[0].d === 1) return `swap ${kindName(shift[0].i.type)} and ${kindName(shift[1].i.type)}`
    return shift[0] && shift[0].d > (shift[1]?.d ?? 0) ? `move ${kindName(shift[0].i.type)}` : 'rearrange sections'
  }
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
      if (!same(pa, pb)) {
        const { design: da, ...wa } = pa
        const { design: db, ...wb } = pb
        if ((wa as { image?: unknown }).image !== (wb as { image?: unknown }).image) return `choose a photo for ${kindName(a[i].type)}`
        if (same(wa, wb) && !same(da, db)) {
          const width = (x: unknown) => (x as { width?: string } | undefined)?.width
          if (a[i].type === 'Image' && width(da) !== width(db)) return 'resize Photo'
          return (da as { show?: string } | undefined)?.show !== (db as { show?: string } | undefined)?.show ? `show or hide ${kindName(a[i].type)}` : `change the look of ${kindName(a[i].type)}`
        }
        // The photo's shape and fit: settings of the Image section, not its words.
        const only = (keys: string[]) => Object.keys({ ...wa, ...wb }).every((k) => keys.includes(k) || same((wa as Record<string, unknown>)[k], (wb as Record<string, unknown>)[k]))
        if (a[i].type === 'Image' && only(['ratio', 'fit'])) return (wa as { ratio?: unknown }).ratio !== (wb as { ratio?: unknown }).ratio ? 'change the shape of Photo' : 'change how Photo fits'
        return 'edit the words'
      }
    }
  }
  if (parts.length === 1) return `${verb} ${nameOf(parts[0])}`
  if (parts.length > 1) return `change ${parts.length} parts`
  const ra = before.root?.props ?? {}
  const rb = after.root?.props ?? {}
  if (!same(ra.intended, rb.intended)) return 'a layout note marked as intended'
  if (!same(ra.edits, rb.edits)) {
    // Changed words on a project page are kept with the page; category names are shared ones.
    const ea = (ra.edits ?? {}) as Record<string, unknown>, eb = (rb.edits ?? {}) as Record<string, unknown>
    const changed = Object.keys({ ...ea, ...eb }).filter((k) => !same(ea[k], eb[k]))
    return changed.every((k) => k.startsWith('category:')) ? 'rename a category' : 'edit the words'
  }
  return 'the last change'
}
