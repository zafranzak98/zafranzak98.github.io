// Project colours, worked out once for the whole site.
//
// Each project's Opening colour (chosen in the editor) is its preferred colour. A project keeps
// it unless that would put it next to the same or a too-similar colour anywhere it is listed
// (the All projects page or its category page), or would repeat a colour already used on its
// category page when a distinct alternative exists. Then it takes the nearest suitable colour
// from the approved palette. The result is one colour per project, used for its band on every page
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

// How much each kind of imperfection costs. A colour repeated within one category page outweighs
// a project leaving its preferred colour; a repeat close together on the All page counts least.
const COST = { categoryRepeat: 100, notPreferred: 10, nearbyRepeatOnAll: 1 }

// Returns a Map of slug -> colour. Neighbours never share the same or a too-similar colour (a hard
// rule). Among the arrangements that satisfy it, the one with the lowest COST is chosen.
// Throws with a plain explanation if no arrangement satisfies the hard rule.
export function assignColours(projects) {
  const lists = listings(projects)
  const order = lists[0].items
  const index = new Map(order.map((p, i) => [p.slug, i]))
  const neighbours = new Map(order.map((p) => [p.slug, new Set()]))
  for (const { items } of lists)
    for (let i = 1; i < items.length; i++) {
      neighbours.get(items[i].slug).add(items[i - 1].slug)
      neighbours.get(items[i - 1].slug).add(items[i].slug)
    }
  // Pairs of projects that count as a repeat if they share a colour, with the cost of doing so.
  const pairs = new Map(order.map((p) => [p.slug, []]))
  const addPair = (a, b, cost) => {
    const [early, late] = index.get(a) < index.get(b) ? [a, b] : [b, a]
    pairs.get(late).push([early, cost])
  }
  for (const { items } of lists.slice(1))
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) addPair(items[i].slug, items[j].slug, COST.categoryRepeat)
  for (let i = 0; i + 2 < order.length; i++) addPair(order[i].slug, order[i + 2].slug, COST.nearbyRepeatOnAll)
  const preferredOf = (p) => (PALETTE.includes(p.opening_colour) ? p.opening_colour : 'Olive')
  const choices = (p) => [preferredOf(p), ...FALLBACKS[preferredOf(p)]]

  // Depth-first search with pruning: try each project's preferred colour first, skip any colour
  // that breaks the neighbour rule, and abandon a branch once it costs more than the best found.
  const assigned = new Map()
  let best = null
  let bestCost = Infinity
  let budget = 500000
  const place = (i, cost) => {
    if (cost >= bestCost || budget-- <= 0) return
    if (i === order.length) {
      best = new Map(assigned)
      bestCost = cost
      return
    }
    const p = order[i]
    for (const colour of choices(p)) {
      if ([...neighbours.get(p.slug)].some((n) => assigned.has(n) && tooSimilar(assigned.get(n), colour))) continue
      let extra = colour === preferredOf(p) ? 0 : COST.notPreferred
      for (const [other, c] of pairs.get(p.slug)) if (assigned.get(other) === colour) extra += c
      assigned.set(p.slug, colour)
      place(i + 1, cost + extra)
      assigned.delete(p.slug)
    }
  }
  place(0, 0)
  if (!best) {
    const busiest = [...neighbours].sort((a, b) => b[1].size - a[1].size)[0]
    throw new Error(
      `Project colours: no arrangement of the five approved colours keeps every pair of neighbouring projects distinct. ` +
        `"${busiest[0]}" sits next to ${[...busiest[1]].map((s) => `"${s}"`).join(', ')}. Change the project order or opening colours.`,
    )
  }
  return best
}
