// Layout checks: the page is measured for elements you have changed (moved, resized, turned or
// restyled) that now overlap something, run off the screen, stick out of their section, are partly
// hidden, are hard to read against their background, or have become too small to read. They run
// quietly while you edit (layout notes) and at every screen size before publishing. They never block
// anything.
//
// Suggestions (advice: true) are gentler: a part moved a long way from its designed place, a part
// that just misses lining up with the edge of the text around it, or spacing clearly unlike the
// spacing around it. They compare only with the page itself (its designed positions and its
// unchanged parts), so no page is held to another page's layout; and when the page gives too little
// to compare with, nothing is said. A suggestion may offer a fix, applied only when you choose it.

export type Kind = 'off-screen' | 'overlap' | 'outside' | 'clipped' | 'small' | 'contrast'
// key and blockId name the element; kind (with the other element, for overlaps) names the problem.
export type Fix = { label: string; dx?: number; dy?: number; back?: boolean } // px to move, or back to the designed place
export type Finding = { screen: string; text: string; key?: string; blockId?: string; kind?: string; advice?: boolean; fix?: Fix }
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
// What you can see of an element: a cover's turned image reaches beyond its own box.
function visualRect(el: HTMLElement): DOMRect {
  const r = el.getBoundingClientRect()
  const tilt = el.children.length === 1 && el.firstElementChild!.classList.contains('tilt') ? el.firstElementChild!.getBoundingClientRect() : null
  if (!tilt) return r
  const left = Math.min(r.left, tilt.left), top = Math.min(r.top, tilt.top)
  return new DOMRect(left, top, Math.max(r.right, tilt.right) - left, Math.max(r.bottom, tilt.bottom) - top)
}
const px = (n: number) => `${Math.round(Math.abs(n))} px`
const offsetOf = (el: HTMLElement) => {
  const o = el.ownerDocument.defaultView!.getComputedStyle(el)
  return [o.position === 'relative' ? parseFloat(o.left) || 0 : 0, o.position === 'relative' ? parseFloat(o.top) || 0 : 0]
}
const isText = (el: HTMLElement) => !el.querySelector('img') && !!el.textContent?.trim()
const beyond = (r: DOMRect, box: DOMRect, by = 2) => r.left < box.left - by || r.right > box.right + by || r.top < box.top - by || r.bottom > box.bottom + by

export function checkPage(doc: Document, screen: string, nameOf: (key: string) => string, options: CheckOptions = {}): Finding[] {
  const out: Finding[] = []
  const view = doc.defaultView!
  const width = doc.documentElement.clientWidth
  const all = [...doc.querySelectorAll<HTMLElement>('[data-el]')].filter((el) => el.getBoundingClientRect().width > 0)
  for (const el of all.filter(isChanged)) {
    const name = nameOf(el.dataset.el!)
    const r = visualRect(el)
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
  out.push(...suggestions(doc, screen, nameOf, all))
  return [...new Map(out.map((f) => [noteId(f), f])).values()]
}

// The three suggestions. Each looks only at parts that were moved at this size, and compares them with
// the page's own design, so an untouched page never gets one.
function suggestions(doc: Document, screen: string, nameOf: (key: string) => string, all: HTMLElement[]): Finding[] {
  const out: Finding[] = []
  const width = doc.documentElement.clientWidth
  for (const el of all) {
    const [x, y] = offsetOf(el)
    if (!x && !y) continue // not moved
    const block = blockOf(el)
    if (!block) continue
    const name = nameOf(el.dataset.el!)
    const at = { screen, key: el.dataset.el!, blockId: block.getAttribute('data-puck-component') ?? '', advice: true }
    const r = el.getBoundingClientRect()

    // 1. Far from where it was designed to sit: more than a fifth of the page across, or more than its
    //    own height (and at least 120px) down. Small nudges are left alone.
    const far = Math.abs(x) > Math.max(120, width * 0.2) || Math.abs(y) > Math.max(120, r.height)
    if (far) {
      const where = [x && `${px(x)} ${x > 0 ? 'right' : 'left'}`, y && `${px(y)} ${y > 0 ? 'down' : 'up'}`].filter(Boolean).join(' and ')
      out.push({ ...at, kind: 'far', text: `${name} is ${where} from where it was designed to sit.`, fix: { label: 'Move it back', back: true } })
    }

    // 2. Just misses an edge: text moved sideways whose left edge (or centre) lands 4 to 24px from
    //    the left edge (or centre) of unchanged text in the same section, or of the section's content.
    //    Further away than that reads as a deliberate placement, so it is not mentioned.
    if (x && isText(el)) {
      const others = all.filter((o) => o !== el && blockOf(o) === block && isText(o) && !isChanged(o))
      const lefts = others.map((o) => o.getBoundingClientRect().left)
      const centres = others.map((o) => { const b = o.getBoundingClientRect(); return b.left + b.width / 2 })
      const near = (value: number, lines: number[]) => lines.map((l) => l - value).filter((d) => Math.abs(d) >= 4 && Math.abs(d) <= 24).sort((a, b) => Math.abs(a) - Math.abs(b))[0]
      const onLine = (value: number, lines: number[]) => lines.some((l) => Math.abs(l - value) < 4)
      const centre = r.left + r.width / 2
      if (lefts.length && !onLine(r.left, lefts) && !onLine(centre, centres)) {
        const dl = near(r.left, lefts)
        const dc = near(centre, centres)
        const d = dl ?? dc
        if (d !== undefined) out.push({ ...at, kind: 'edge', text: `${name} is ${px(d)} off the ${dl !== undefined ? 'left edge' : 'centre'} of the text around it.`, fix: { label: 'Line it up', dx: d } })
      }
    }

    // 3. Spacing unlike the section's own: a part moved up or down changes the gaps above and below
    //    it. The section's spacing is read from its unchanged neighbours in the same column and from
    //    this part's own gaps as designed. A gap is mentioned only when it moved well away from its
    //    designed size (by more than 16px and by more than half) and matches none of the section's
    //    spacings (within 8px). With fewer than two spacings to go on, nothing is said.
    if (y && !far) {
      const column = all
        .filter((o) => blockOf(o) === block && (o === el || (!o.contains(el) && !el.contains(o))))
        .map((o) => ({ o, b: o === el ? r : o.getBoundingClientRect() }))
        .filter(({ b }) => b.width > 0 && Math.min(b.right, r.right) - Math.max(b.left, r.left) > Math.min(b.width, r.width) / 2)
        .sort((p1, p2) => p1.b.top - p2.b.top)
      const i = column.findIndex(({ o }) => o === el)
      const steady: number[] = []
      for (let k = 1; k < column.length; k++) {
        if (k === i || k - 1 === i || isChanged(column[k].o) || isChanged(column[k - 1].o)) continue
        const gap = column[k].b.top - column[k - 1].b.bottom
        if (gap >= 4) steady.push(gap)
      }
      const above = i > 0 ? r.top - column[i - 1].b.bottom : NaN
      const below = i >= 0 && i < column.length - 1 ? column[i + 1].b.top - r.bottom : NaN
      const designedAbove = above - y
      const designedBelow = below + y
      const rhythm = [...steady, designedAbove, designedBelow].filter((g) => Number.isFinite(g) && g >= 4)
      const distinct = rhythm.filter((g, k) => rhythm.findIndex((h) => Math.abs(h - g) <= 4) === k)
      const judge = (gap: number, designed: number) => Number.isFinite(gap) && gap >= 0 && Math.abs(gap - designed) > Math.max(16, designed / 2) && !rhythm.some((g) => Math.abs(g - gap) <= 8)
      if (distinct.length >= 2) {
        const nearest = (gap: number) => rhythm.reduce((best, g) => (Math.abs(g - gap) < Math.abs(best - gap) ? g : best))
        if (judge(above, designedAbove)) {
          const to = nearest(above)
          out.push({ ...at, kind: 'spacing', text: `${name} has ${px(above)} of space above it; the nearest spacing used in this section is ${px(to)}.`, fix: { label: 'Match the spacing', dy: to - above } })
        } else if (judge(below, designedBelow)) {
          const to = nearest(below)
          out.push({ ...at, kind: 'spacing', text: `${name} has ${px(below)} of space below it; the nearest spacing used in this section is ${px(to)}.`, fix: { label: 'Match the spacing', dy: below - to } })
        }
      }
    }
  }
  return out
}
