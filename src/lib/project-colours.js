// Project colours, worked out once for the whole site.
//
// Each project's Opening colour (chosen in the editor) is its preferred colour. A project keeps
// it unless that would put it next to the same or a too-similar colour anywhere it is listed:
// the All projects page or its category page. Then it takes the nearest distinct colour from
// the approved palette. The result is one colour per project, used for its band on every page
// and for its case study opening. The website and the build check (scripts/postbuild.mjs) both
// use this file, so they always agree.
//
// Plain JavaScript so the build check can run it with Node as well.

export const PALETTE = ['Olive', 'Sage', 'Light sage', 'Off-white', 'Terracotta']

// Pairs that read as one block when they sit next to each other: close in tone (measured
// contrast between the two backgrounds 1.33 to 1.5) or, for Olive and Terracotta, both dark.
const SIMILAR = [
  ['Off-white', 'Light sage'],
  ['Sage', 'Light sage'],
  ['Olive', 'Terracotta'],
]
export const tooSimilar = (a, b) => a === b || SIMILAR.some(([x, y]) => (a === x && b === y) || (a === y && b === x))

// When the preferred colour cannot be used, the nearest alternatives in order. Sage comes last
// because small text on Sage cannot reach the WCAG AA ratio with any palette colour.
const FALLBACKS = {
  Olive: ['Terracotta', 'Off-white', 'Light sage', 'Sage'],
  Sage: ['Off-white', 'Olive', 'Terracotta', 'Light sage'],
  'Light sage': ['Off-white', 'Olive', 'Terracotta', 'Sage'],
  'Off-white': ['Light sage', 'Olive', 'Terracotta', 'Sage'],
  Terracotta: ['Olive', 'Off-white', 'Light sage', 'Sage'],
}

const byOrder = (a, b) => (a.order ?? 999) - (b.order ?? 999) || (a.title ?? '').localeCompare(b.title ?? '')
const hasPage = (p) => p.page_type === 'Full case study'

// The order projects are listed in: case studies first, then projects listed without a page.
export const bandOrder = (projects) => {
  const sorted = [...projects].sort(byOrder)
  return [...sorted.filter(hasPage), ...sorted.filter((p) => !hasPage(p))]
}

// Every list a project appears in: All projects, then each category in the same order.
export const listings = (projects) => {
  const all = bandOrder(projects)
  const categories = [...new Set(all.map((p) => p.category))]
  return [{ name: 'All projects', items: all }, ...categories.map((c) => ({ name: `category "${c}"`, items: all.filter((p) => p.category === c) }))]
}

// Returns a Map of slug -> colour. Throws with a plain explanation if no arrangement works.
export function assignColours(projects) {
  const lists = listings(projects)
  const order = lists[0].items
  const neighbours = new Map(order.map((p) => [p.slug, new Set()]))
  for (const { items } of lists)
    for (let i = 1; i < items.length; i++) {
      neighbours.get(items[i].slug).add(items[i - 1].slug)
      neighbours.get(items[i - 1].slug).add(items[i].slug)
    }
  const choices = (p) => {
    const preferred = PALETTE.includes(p.opening_colour) ? p.opening_colour : 'Olive'
    return [preferred, ...FALLBACKS[preferred]]
  }
  const assigned = new Map()
  // Depth-first: each project tries its preferred colour first, so substitutions only happen
  // where a clash forces them, and an earlier project gives way only if nothing else works.
  const place = (i) => {
    if (i === order.length) return true
    const p = order[i]
    for (const colour of choices(p)) {
      if ([...neighbours.get(p.slug)].some((n) => assigned.has(n) && tooSimilar(assigned.get(n), colour))) continue
      assigned.set(p.slug, colour)
      if (place(i + 1)) return true
      assigned.delete(p.slug)
    }
    return false
  }
  if (!place(0)) {
    const busiest = [...neighbours].sort((a, b) => b[1].size - a[1].size)[0]
    throw new Error(
      `Project colours: no arrangement of the five approved colours keeps every pair of neighbouring projects distinct. ` +
        `"${busiest[0]}" sits next to ${[...busiest[1]].map((s) => `"${s}"`).join(', ')}. Change the project order or opening colours.`,
    )
  }
  return assigned
}
