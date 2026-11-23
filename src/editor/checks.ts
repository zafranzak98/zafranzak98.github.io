// Safety checks before publishing: the page is measured at each screen size for elements you have
// changed (moved, resized or restyled) that now overlap something, run off the screen, are hard to
// read against their background, or have become too small to read. They never block publishing.

export type Finding = { screen: string; text: string }

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

export function checkPage(doc: Document, screen: string, nameOf: (key: string) => string): Finding[] {
  const out: Finding[] = []
  const width = doc.documentElement.clientWidth
  const all = [...doc.querySelectorAll<HTMLElement>('[data-el]')].filter((el) => el.getBoundingClientRect().width > 0)
  for (const el of all.filter(isChanged)) {
    const name = nameOf(el.dataset.el!)
    const r = el.getBoundingClientRect()
    if (r.left < -1 || r.right > width + 1) out.push({ screen, text: `${name} runs off the edge of the screen.` })
    for (const other of all) {
      if (other === el || other.contains(el) || el.contains(other)) continue
      const o = other.getBoundingClientRect()
      const w = Math.min(r.right, o.right) - Math.max(r.left, o.left)
      const h = Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top)
      if (w > 2 && h > 2) out.push({ screen, text: `${name} overlaps ${nameOf(other.dataset.el!)}.` })
    }
    const look = el.ownerDocument.defaultView!.getComputedStyle(el)
    if (!el.querySelector('img') && el.textContent?.trim()) {
      const size = parseFloat(look.fontSize)
      if (size < MIN_TEXT) out.push({ screen, text: `${name} is ${size.toFixed(1)}px, smaller than the ${MIN_TEXT}px minimum for reading.` })
      const large = size >= 24 || (size >= 18.66 && Number(look.fontWeight) >= 700)
      const r2 = ratio(rgb(look.color), backgroundOf(el))
      if (r2 < (large ? 3 : 4.5)) out.push({ screen, text: `${name} is hard to read against its background (${r2.toFixed(1)}:1; ${large ? '3' : '4.5'}:1 needed).` })
    }
  }
  return [...new Map(out.map((f) => [`${f.screen}|${f.text}`, f])).values()]
}
