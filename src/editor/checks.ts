// Layout checks: the page is measured for elements you have changed (moved, resized or restyled)
// that now overlap something, run off the screen, stick out of their section, are partly hidden,
// are hard to read against their background, or have become too small to read. They run quietly
// while you edit (layout notes) and at every screen size before publishing. They never block anything.

export type Kind = 'off-screen' | 'overlap' | 'outside' | 'clipped' | 'small' | 'contrast'
// key and blockId name the element; kind (with the other element, for overlaps) names the problem.
export type Finding = { screen: string; text: string; key?: string; blockId?: string; kind?: string }
export type CheckOptions = {
  // An approved design exception: return true to leave this element's contrast alone.
  approvedContrast?: (el: HTMLElement, ratio: number) => boolean
}
// One note, at one screen size, for one element: what "This is intended" remembers.
export const noteId = (f: Finding) => `${f.blockId}|${f.key}|${f.screen.toLowerCase()}|${f.kind}`

const MIN_TEXT = 12 // px

function luminance([r, g, b]: number[]) {
  const [R, G, B] = [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}
const rgb = (colour: string) => (colour.match(/[\d.]+/g) ?? []).map(Number)
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// The colour behind an element: the nearest ancestor with a solid background.
function backgroundOf(el: HTMLElement) {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const c = rgb(n.ownerDocument.defaultView!.getComputedStyle(n).backgroundColor)
    if (c.length >= 3 && (c.length === 3 || c[3] > 0.9)) return c.slice(0, 3)
  }
  return [255, 255, 255]
}

// An element counts as changed when it carries any single-element setting.
const isChanged = (el: HTMLElement) => /(^|\s)el-[a-z]+-[dtp](\s|$)/.test(el.className)

const blockOf = (el: Element) => el.closest('[data-puck-component]')
const beyond = (r: DOMRect, box: DOMRect, by = 2) => r.left < box.left - by || r.right > box.right + by || r.top < box.top - by || r.bottom > box.bottom + by

export function checkPage(doc: Document, screen: string, nameOf: (key: string) => string, options: CheckOptions = {}): Finding[] {
  const out: Finding[] = []
  const view = doc.defaultView!
  const width = doc.documentElement.clientWidth
  const all = [...doc.querySelectorAll<HTMLElement>('[data-el]')].filter((el) => el.getBoundingClientRect().width > 0)
  for (const el of all.filter(isChanged)) {
    const name = nameOf(el.dataset.el!)
    const r = el.getBoundingClientRect()
    const block = blockOf(el)
    const at = { screen, key: el.dataset.el!, blockId: block?.getAttribute('data-puck-component') ?? '' }
    const add = (kind: string, text: string) => out.push({ ...at, kind, text })
    if (r.left < -1 || r.right > width + 1) add('off-screen', `${name} runs off the edge of the screen.`)
    // Sticking out of its own section, or cut off by a part of the page that hides what overflows it.
    if (block && beyond(r, block.getBoundingClientRect())) add('outside', `${name} sticks out of its section.`)
    for (let n = el.parentElement; n && n !== block?.parentElement; n = n.parentElement) {
      const o = view.getComputedStyle(n)
      if (/hidden|clip/.test(o.overflowX + o.overflowY) && beyond(r, n.getBoundingClientRect())) { add('clipped', `${name} is partly hidden: part of it is cut off.`); break }
    }
    for (const other of all) {
      if (other === el || other.contains(el) || el.contains(other)) continue
      const o = other.getBoundingClientRect()
      const w = Math.min(r.right, o.right) - Math.max(r.left, o.left)
      const h = Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top)
      if (w > 2 && h > 2) add(`overlap:${other.dataset.el}`, `${name} overlaps ${nameOf(other.dataset.el!)}.`)
    }
    const look = el.ownerDocument.defaultView!.getComputedStyle(el)
    if (!el.querySelector('img') && el.textContent?.trim()) {
      const size = parseFloat(look.fontSize)
      if (size < MIN_TEXT) add('small', `${name} is ${size.toFixed(1)}px, smaller than the ${MIN_TEXT}px minimum for reading.`)
      const large = size >= 24 || (size >= 18.66 && Number(look.fontWeight) >= 700)
      const r2 = ratio(rgb(look.color), backgroundOf(el))
      if (r2 < (large ? 3 : 4.5) && !options.approvedContrast?.(el, r2)) add('contrast', `${name} is hard to read against its background (${r2.toFixed(1)}:1; ${large ? '3' : '4.5'}:1 needed).`)
    }
  }
  return [...new Map(out.map((f) => [noteId(f), f])).values()]
}
