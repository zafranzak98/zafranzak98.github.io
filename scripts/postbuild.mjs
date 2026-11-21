// Runs after "vite build". Three jobs:
// 1. Give every real page its own index.html, so direct links answer "200 OK" instead of "404".
// 2. In production mode, remove media used only by drafts, then fail if any draft content remains.
// 3. Check the content and report sizes against GitHub's limits.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execSync } from 'node:child_process'
import matter from 'gray-matter'

const PREVIEW = process.env.VITE_SITE_MODE === 'preview'
const DIST = 'dist'
const errors = []
const warnings = []
const read = (dir) => readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ({ slug: f.replace(/\.md$/, ''), ...matter(readFileSync(join(dir, f), 'utf8')).data }))
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
const mediaIn = (value, out = new Set()) => {
  if (typeof value === 'string') { if (value.startsWith('/media/') || value.startsWith('/files/')) out.add(value) }
  else if (Array.isArray(value)) value.forEach((v) => mediaIn(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => mediaIn(v, out))
  return out
}

const projects = read('content/projects')
const categories = read('content/categories')
const about = matter(readFileSync('content/about.md', 'utf8')).data
const siteText = readFileSync('content/site.yml', 'utf8')
const catSlugs = new Set(categories.map((c) => c.slug))
const live = projects.filter((p) => PREVIEW || p.status !== 'Draft')
const drafts = projects.filter((p) => p.status === 'Draft')

// ---- content checks
for (const p of projects) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) errors.push(`Project "${p.slug}": the web address may only use lowercase letters, numbers and hyphens.`)
  if (!catSlugs.has(p.category)) errors.push(`Project "${p.slug}": category "${p.category}" does not exist in Categories.`)
  for (const m of mediaIn(p)) if (!existsSync(join('public', m))) errors.push(`Project "${p.slug}": file not found: ${m}`)
}
for (const m of mediaIn(about)) if (!existsSync(join('public', m))) errors.push(`About: file not found: ${m}`)
for (const m of siteText.match(/\/(media|files)\/[^\s"']+/g) ?? []) if (!existsSync(join('public', m))) errors.push(`Site settings: file not found: ${m}`)

// ---- 1. real pages for direct links
const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const page = (path, title) => {
  mkdirSync(join(DIST, path), { recursive: true })
  writeFileSync(join(DIST, path, 'index.html'), html.replace(/<title>.*?<\/title>/, `<title>${title.replace(/&/g, '&amp;')} · Zafran Zakaria</title>`))
}
page('about', 'About')
page('projects', 'Projects')
const usedCats = new Set(live.map((p) => p.category))
for (const c of categories) if (usedCats.has(c.slug)) page(`projects/${c.slug}`, c.name)
for (const p of live) if (p.page_type === 'Full case study') page(`projects/${p.category}/${p.slug}`, p.title)
cpSync(join(DIST, 'index.html'), join(DIST, '404.html'))

// ---- 2. drafts: hidden from the production website (the repository itself is public)
if (!PREVIEW) {
  const keep = new Set([...live.flatMap((p) => [...mediaIn(p)]), ...mediaIn(about), ...(siteText.match(/\/(media|files)\/[^\s"']+/g) ?? [])])
  const draftOnly = [...new Set(drafts.flatMap((p) => [...mediaIn(p)]))].filter((m) => !keep.has(m))
  for (const m of draftOnly) rmSync(join(DIST, m), { force: true })
  // Remove folders left empty, so not even a draft's folder name is published.
  const prune = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) prune(join(dir, e.name)); if (dir !== DIST && !readdirSync(dir).length) rmSync(dir, { recursive: true }) }
  prune(DIST)
  const built = walk(DIST).filter((f) => /\.(html|js|css|json|txt|xml)$/.test(f)).map((f) => [f, readFileSync(f, 'utf8')])
  for (const d of drafts) {
    for (const needle of [d.title, `/${d.slug}`, ...draftOnly].filter(Boolean)) {
      const hit = built.find(([, text]) => text.includes(needle))
      if (hit) errors.push(`Draft "${d.slug}" was found in the production build (${relative(DIST, hit[0])}: "${needle}").`)
    }
    for (const m of draftOnly) if (existsSync(join(DIST, m))) errors.push(`Draft-only file is still in the production build: ${m}`)
  }
}

// ---- 3. sizes
const MB = 1024 * 1024
const size = (dir) => walk(dir).reduce((n, f) => n + statSync(f).size, 0)
const siteSize = size(DIST)
let repoSize = 0
try { repoSize = Number(execSync('git count-objects -v', { encoding: 'utf8' }).match(/size-pack: (\d+)/)?.[1] ?? 0) * 1024 } catch {}
const biggest = walk('public').map((f) => [f, statSync(f).size]).sort((a, b) => b[1] - a[1])
for (const [f, s] of biggest) {
  if (s > 20 * MB) warnings.push(`${f} is ${(s / MB).toFixed(1)} MB. GitHub blocks files over 100 MB and warns from 50 MB.`)
  else if (s > MB && /\.(jpe?g|png|webp|gif)$/i.test(f)) warnings.push(`${f} is ${(s / MB).toFixed(1)} MB. Images over 1 MB slow the site down.`)
}
if (siteSize > 500 * MB) warnings.push(`The published website is ${(siteSize / MB).toFixed(0)} MB. GitHub Pages allows up to 1 GB.${siteSize > 800 * MB ? ' URGENT.' : ''}`)
if (repoSize > 500 * MB) warnings.push(`The repository is ${(repoSize / MB).toFixed(0)} MB. GitHub recommends staying under 1 GB.${repoSize > 800 * MB ? ' URGENT.' : ''}`)

const report = [
  `Mode: ${PREVIEW ? 'preview (drafts shown)' : 'production (drafts excluded)'}`,
  `Projects: ${live.length} built, ${PREVIEW ? 0 : drafts.length} draft(s) excluded`,
  `Published website: ${(siteSize / MB).toFixed(2)} MB of 1,024 MB (GitHub Pages limit)`,
  `Repository: ${(repoSize / MB).toFixed(2)} MB of 1,024 MB (GitHub recommendation)`,
  `Largest file: ${biggest[0] ? `${biggest[0][0]} (${(biggest[0][1] / MB).toFixed(2)} MB; limit 100 MB)` : 'none'}`,
  ...warnings.map((w) => `WARNING: ${w}`),
  ...errors.map((e) => `ERROR: ${e}`),
]
console.log('\n' + report.join('\n') + '\n')
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Site check\n\n' + report.map((r) => `- ${r}`).join('\n') + '\n')
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `warnings<<EOF\n${warnings.join('\n')}\nEOF\n`)
if (errors.length) process.exit(1)
