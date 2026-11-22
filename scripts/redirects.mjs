// The redirect registry: every web address a project has ever had, worked out from the save history.
//
// Each save in the website editor is a commit, so the history is a permanent, complete record of
// every title, category and Web address override each project has had. Reading it on every build
// means an old address can never be forgotten: no list has to be kept up to date by hand. The
// project's file name is also kept as an address, since it was the address before this system.
//
// Returns { redirects, conflicts }. redirects maps an old page path to the project's current path.
// Rules that keep it safe:
//  - a current page always wins, so an address in use is never redirected (no loops, no clashes);
//  - every redirect points straight at a current page, never at another redirect;
//  - an old address two projects have both had goes to the one that had it most recently, and is
//    reported in conflicts.
import { execFileSync } from 'node:child_process'
import matter from 'gray-matter'
import { addressOf, pagePath } from '../src/lib/project-urls.js'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

// Every (category, address) a project file has had, newest first, with the time it was last used.
function pastPaths(id, file) {
  const seen = new Map()
  let commits = []
  try {
    commits = git('log', '--format=%H %ct', '--', file).trim().split('\n').filter(Boolean)
  } catch {
    return seen
  }
  for (const line of commits) {
    const [hash, time] = line.split(' ')
    let data
    try {
      data = matter(git('show', `${hash}:${file}`)).data
    } catch {
      continue // the file did not exist at this commit (for example the commit that deleted it)
    }
    if (!data?.category) continue
    for (const address of [addressOf(data), id]) {
      if (!address) continue
      const path = pagePath(data.category, address)
      if (!seen.has(path)) seen.set(path, Number(time))
    }
  }
  return seen
}

// projects: the projects being published, each { slug (file name), category, title, url }.
// current: every page path the build is publishing (projects, categories and the rest).
export function redirectRegistry(projects, current) {
  const claims = new Map() // old path -> [{ to, time, id }]
  for (const p of projects) {
    const to = pagePath(p.category, addressOf(p))
    const history = pastPaths(p.slug, `content/projects/${p.slug}.md`)
    // The file name as an address, in the current category, even before it has any history.
    if (!history.has(pagePath(p.category, p.slug))) history.set(pagePath(p.category, p.slug), 0)
    for (const [path, time] of history) {
      if (path === to || current.has(path)) continue
      if (!claims.has(path)) claims.set(path, [])
      claims.get(path).push({ to, time, id: p.slug })
    }
  }
  const redirects = new Map()
  const conflicts = []
  for (const [path, list] of claims) {
    const owners = [...new Map(list.map((c) => [c.id, c])).values()].sort((a, b) => b.time - a.time)
    redirects.set(path, owners[0].to)
    if (owners.length > 1) conflicts.push(`${path} was used by ${owners.map((o) => `"${o.id}"`).join(' and ')}; it now goes to "${owners[0].id}", which used it most recently.`)
  }
  return { redirects, conflicts }
}

// True when the history is incomplete (a shallow copy), which would silently drop old addresses.
export const historyIsShallow = () => {
  try {
    return git('rev-parse', '--is-shallow-repository').trim() === 'true'
  } catch {
    return true
  }
}
