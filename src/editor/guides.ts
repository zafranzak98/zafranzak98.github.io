// Alignment guides for moving a single element in the design editor. Everything here measures the
// page shown in the editor at its current screen size, and draws only in the editor's own layer,
// which is never part of the website.

export type Line = { at: number; label: string } // a position on the page, in page pixels
export type Lines = { across: Line[]; down: Line[] } // vertical lines (x positions) and horizontal lines (y positions)
export type Box = { left: number; right: number; top: number; bottom: number; baseline?: number }

// Where the first line of text in an element sits on the page (its baseline), if it has text.
export function baselineOf(el: HTMLElement): number | undefined {
  const doc = el.ownerDocument
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) })
  const text = walker.nextNode()
  if (!text) return undefined
  const range = doc.createRange()
  range.selectNodeContents(text)
  const line = range.getClientRects()[0]
  if (!line) return undefined
  const look = doc.defaultView!.getComputedStyle(text.parentElement!)
  const ctx = doc.createElement('canvas').getContext('2d')
  if (!ctx) return undefined
  ctx.font = `${look.fontStyle} ${look.fontWeight} ${look.fontSize} ${look.fontFamily}`
  const m = ctx.measureText('Hg')
  const contentHeight = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent
  return line.top + (line.height - contentHeight) / 2 + m.fontBoundingBoxAscent
}

export function boxOf(el: HTMLElement): Box {
  const r = el.getBoundingClientRect()
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, baseline: baselineOf(el) }
}

// Everything the moving element can line up with: other elements' edges, centres and baselines in
// its section, the content column, the page margins and the page centre.
export function linesFor(moving: HTMLElement, nameOf: (key: string) => string): Lines {
  const doc = moving.ownerDocument
  const across: Line[] = []
  const down: Line[] = []
  // Other elements count only within the same section (or the same free grid), so nothing far away on
  // the page pulls an element out of place; the column, margins and centre apply everywhere.
  const scope = moving.closest('.free-grid') ?? moving.closest('[data-puck-component]') ?? doc.body
  for (const other of scope.querySelectorAll<HTMLElement>('[data-el]')) {
    if (other === moving || other.contains(moving) || moving.contains(other)) continue
    const r = other.getBoundingClientRect()
    if (!r.width || !r.height) continue
    const name = nameOf(other.dataset.el!)
    across.push({ at: r.left, label: `left edge of ${name}` }, { at: r.right, label: `right edge of ${name}` }, { at: (r.left + r.right) / 2, label: `centre of ${name}` })
    down.push({ at: r.top, label: `top of ${name}` }, { at: r.bottom, label: `bottom of ${name}` })
    const base = baselineOf(other)
    if (base !== undefined) down.push({ at: base, label: `text line of ${name}` })
  }
  const section = moving.closest('.cs-sec, .cs-open, .facts, .free-block, section')
  const body = moving.closest('.cs-sec')?.querySelector('.cs-body')
  if (body) across.push({ at: body.getBoundingClientRect().left, label: 'content column' })
  if (section) {
    const r = section.getBoundingClientRect()
    const look = doc.defaultView!.getComputedStyle(section)
    across.push({ at: r.left + parseFloat(look.paddingLeft), label: 'page margin' }, { at: r.right - parseFloat(look.paddingRight), label: 'page margin' })
  }
  across.push({ at: doc.documentElement.clientWidth / 2, label: 'page centre' })
  return { across, down }
}

export type Snap = { dx: number; dy: number; hitAcross?: Line; hitDown?: Line }

// How far to shift a box so its nearest edge, centre or baseline lands on a line within `reach`.
export function snap(box: Box, lines: Lines, reach: number): Snap {
  const xs = [box.left, box.right, (box.left + box.right) / 2]
  const ys = [box.top, box.bottom, ...(box.baseline !== undefined ? [box.baseline] : [])]
  const nearest = (points: number[], candidates: Line[]) => {
    let best: { d: number; line: Line } | undefined
    for (const line of candidates) for (const pt of points) {
      const d = line.at - pt
      if (Math.abs(d) <= reach && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line }
    }
    return best
  }
  const a = nearest(xs, lines.across)
  const d = nearest(ys, lines.down)
  return { dx: a?.d ?? 0, dy: d?.d ?? 0, hitAcross: a?.line, hitDown: d?.line }
}

// The editor's own drawing layer inside the page preview. It ignores clicks and holds only the guides.
export function drawGuides(doc: Document, s: Snap) {
  clearGuides(doc)
  const layer = doc.createElement('div')
  layer.className = 'el-guides'
  layer.setAttribute('aria-hidden', 'true')
  const view = doc.defaultView!
  if (s.hitAcross) layer.append(guide(doc, { left: `${s.hitAcross.at + view.scrollX}px`, top: '0', width: '0', height: `${doc.documentElement.scrollHeight}px` }))
  if (s.hitDown) layer.append(guide(doc, { top: `${s.hitDown.at + view.scrollY}px`, left: '0', height: '0', width: `${doc.documentElement.scrollWidth}px` }))
  doc.body.append(layer)
}
function guide(doc: Document, at: Partial<CSSStyleDeclaration>) {
  const g = doc.createElement('div')
  g.className = 'el-guide'
  Object.assign(g.style, at)
  return g
}
export const clearGuides = (doc: Document) => doc.querySelectorAll('.el-guides').forEach((n) => n.remove())

// In words, for people using a screen reader.
export function describeSnap(s: Snap) {
  const parts = [s.hitAcross && `lined up with the ${s.hitAcross.label}`, s.hitDown && `lined up with the ${s.hitDown.label}`].filter(Boolean)
  return parts.length ? `Moved; ${parts.join(' and ')}.` : ''
}
