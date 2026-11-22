// Runs after "vite build". Four jobs:
// 1. Give every real page its own index.html, with its title, description and sharing tags,
//    so direct links answer "200 OK" instead of "404".
// 2. In production mode, remove media used only by drafts, then fail if any draft content remains.
// 3. Add the website editor at /admin.
// 4. Check the content and report sizes against GitHub's limits.
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execSync } from 'node:child_process'
import matter from 'gray-matter'
import { assignColours, FOOTER, listings, tooSimilar } from '../src/lib/project-colours.js'
import { isPhoto, variantPath, widthsFor } from '../src/lib/image-variants.js'
import sharp from 'sharp'
import { ADDRESS_PATTERN, addressOf, overrideOf, pagePath } from '../src/lib/project-urls.js'
import { historyIsShallow, redirectRegistry } from './redirects.mjs'
import { mediaIn, publishedMedia } from './published-media.mjs'

const PREVIEW = process.env.VITE_SITE_MODE === 'preview'
const DIST = 'dist'
const errors = []
const warnings = []
const read = (dir) => readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => ({ slug: f.replace(/\.md$/, ''), ...matter(readFileSync(join(dir, f), 'utf8')).data }))
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))

const projects = read('content/projects')
const categories = read('content/categories')
const about = matter(readFileSync('content/about.md', 'utf8')).data
const siteText = readFileSync('content/site.yml', 'utf8')
const site = matter(`---\n${siteText}\n---\n`).data
const siteName = site.name ?? ''
const catSlugs = new Set(categories.map((c) => c.slug))
const live = projects.filter((p) => PREVIEW || p.status !== 'Draft')
const drafts = projects.filter((p) => p.status === 'Draft')

// ---- content checks
for (const p of projects) {
  if (!ADDRESS_PATTERN.test(p.slug)) errors.push(`Project "${p.slug}": the file name may only use lowercase letters, numbers and hyphens.`)
  if (overrideOf(p) && !ADDRESS_PATTERN.test(overrideOf(p))) errors.push(`Project "${p.title}": the Web address "${overrideOf(p)}" may only use lowercase letters, numbers and single hyphens, for example bersihmalaysia.`)
  else if (!addressOf(p)) errors.push(`Project "${p.slug}": its title has no letters or numbers to make a web address from. Fill in the Web address field.`)
  if (!catSlugs.has(p.category)) errors.push(`Project "${p.slug}": category "${p.category}" does not exist in Categories.`)
  for (const m of mediaIn(p)) if (!existsSync(join('public', m))) errors.push(`Project "${p.slug}": file not found: ${m}`)
}
// Two projects can never share a web address, whatever their category or status, so a draft
// cannot later take a published project's address.
const byAddress = new Map()
for (const p of projects) byAddress.set(addressOf(p), [...(byAddress.get(addressOf(p)) ?? []), p])
for (const [address, list] of byAddress)
  if (address && list.length > 1) errors.push(`Web address "${address}" is used by ${list.map((p) => `"${p.title}"`).join(' and ')}. Change one title, or fill in a different Web address for one of them.`)
for (const m of mediaIn(about)) if (!existsSync(join('public', m))) errors.push(`About: file not found: ${m}`)
for (const m of siteText.match(/\/(media|files)\/[^\s"']+/g) ?? []) if (!existsSync(join('public', m))) errors.push(`Site settings: file not found: ${m}`)

// ---- 1. real pages for direct links
// The test site asks search engines not to index it. It stays public: this keeps drafts and
// placeholder text out of search results, it does not hide anything. Production pages carry no
// such tag. robots.txt is left open on purpose, since a crawler must read a page to see its noindex.
const NOINDEX = '<meta name="robots" content="noindex, nofollow" />'
const shell = readFileSync(join(DIST, 'index.html'), 'utf8')
if (PREVIEW && !shell.includes(NOINDEX)) writeFileSync(join(DIST, 'index.html'), shell.replace('  </head>', `    ${NOINDEX}\n  </head>`))
// Every page names its production address as canonical, on the test site too, so search engines
// only ever treat zafranzakaria.com as the real address. Drafts have no production address, so none.
const PRODUCTION_URL = 'https://zafranzakaria.com'
const address = (path) => `${PRODUCTION_URL}/${path ? `${path}/` : ''}`
const canonical = (path) => `<link rel="canonical" href="${address(path)}" />`
// Shared links need full image addresses: the test site's own while testing, the real one in production.
const ORIGIN = PREVIEW ? 'https://zafranzak98.github.io' : PRODUCTION_URL
const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// Text for titles, descriptions and sharing: formatting marks (**highlight**, *bold*) removed.
const plain = (text) => text?.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\s](?:[^*]*[^*\s])?)\*/g, '$1').replace(/\s+/g, ' ').trim()
const html = readFileSync(join(DIST, 'index.html'), 'utf8')
  .replace(/\s*<link rel="canonical"[^>]*>/g, '')
  .replace(/<title>.*?<\/title>/, `<title>${esc(site.site_title)}</title>`)
writeFileSync(join(DIST, '404.html'), html)
const DESCRIPTION = /<meta name="description" content="([^"]*)" \/>/
const defaultDescription = html.match(DESCRIPTION)[1]
const expected = new Map([['index.html', canonical('')]])
const withHead = (path, { title, description, image } = {}, isDraft = false) => {
  const fullTitle = esc(title ? `${title} · ${siteName}` : site.site_title)
  const text = description ? esc(description) : defaultDescription
  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(siteName)}" />`,
    `<meta property="og:title" content="${fullTitle}" />`,
    `<meta property="og:description" content="${text}" />`,
    ...(isDraft ? [] : [`<meta property="og:url" content="${address(path)}" />`, canonical(path)]),
    ...(image ? [`<meta property="og:image" content="${ORIGIN}${encodeURI(image)}" />`, `<meta name="twitter:card" content="summary_large_image" />`] : []),
  ]
  return html
    .replace(/<title>.*?<\/title>/, `<title>${fullTitle}</title>`)
    .replace(DESCRIPTION, `<meta name="description" content="${text}" />`)
    .replace('  </head>', `${tags.map((t) => `    ${t}\n`).join('')}  </head>`)
}
const published = new Set(['']) // every page path written below
const page = (path, meta, isDraft = false) => {
  published.add(path)
  mkdirSync(join(DIST, path), { recursive: true })
  writeFileSync(join(DIST, path, 'index.html'), withHead(path, meta, isDraft))
  if (!isDraft) expected.set(join(path, 'index.html'), canonical(path))
}
writeFileSync(join(DIST, 'index.html'), withHead(''))
page('about', { title: 'About' })
page('projects', { title: 'Projects' })
const usedCats = new Set(live.map((p) => p.category))
const draftOnly = (slug) => !live.some((p) => p.category === slug && p.status !== 'Draft')
for (const c of categories) if (usedCats.has(c.slug)) page(`projects/${c.slug}`, { title: c.name }, draftOnly(c.slug))
// A project's search and sharing details fall back to its title, summary and cover image.
for (const p of live) if (p.page_type === 'Full case study')
  page(pagePath(p.category, addressOf(p)), {
    title: p.seo?.title || p.title,
    description: plain(p.seo?.description || p.summary),
    image: p.seo?.image || p.cover?.image,
  }, p.status === 'Draft')

// Old addresses: a small page at each one that sends visitors and search engines to the current
// address (see scripts/redirects.mjs). GitHub Pages cannot send a real HTTP 301 redirect, so this
// is the standard static alternative: an instant refresh, a script for browsers that ignore it, a
// canonical link to the new address and a plain link. Search engines treat an instant refresh like
// a permanent redirect, but more slowly and less certainly than a 301. Drafts get none in production.
if (historyIsShallow()) errors.push('The save history is incomplete (a shallow copy), so old project addresses cannot be redirected. The build needs the full history.')
const { redirects, conflicts } = redirectRegistry(live.filter((p) => p.page_type === 'Full case study'), published)
for (const c of conflicts) warnings.push(`Old address shared by two projects: ${c}`)
for (const [from, to] of redirects) {
  const target = `/${to}/`
  const doc = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Moved · ${esc(siteName)}</title>
${PREVIEW ? `    ${NOINDEX}\n` : ''}    ${canonical(to)}
    <meta http-equiv="refresh" content="0; url=${target}" />
    <script>location.replace(${JSON.stringify(target)} + location.search + location.hash)</script>
  </head>
  <body>
    <p>This page has moved to <a href="${target}">${esc(`${ORIGIN}${target}`)}</a>.</p>
  </body>
</html>
`
  mkdirSync(join(DIST, from), { recursive: true })
  writeFileSync(join(DIST, from, 'index.html'), doc)
  expected.set(join(from, 'index.html'), canonical(to))
}
writeFileSync(join(DIST, 'redirects.json'), JSON.stringify(Object.fromEntries([...redirects].map(([f, t]) => [`/${f}/`, `/${t}/`])), null, 2))
if (redirects.size) console.log(`Old addresses redirected: ${[...redirects].map(([f, t]) => `/${f}/ -> /${t}/`).join(', ')}`)

// The editor page at /admin is added later and checked on its own.
for (const f of walk(DIST).filter((f) => f.endsWith('.html') && !f.startsWith(join(DIST, 'admin')))) {
  const tagged = readFileSync(f, 'utf8').includes(NOINDEX)
  if (PREVIEW && !tagged) errors.push(`Test site page is missing its noindex tag: ${relative(DIST, f)}`)
  if (!PREVIEW && tagged) errors.push(`Production page must not carry a noindex tag: ${relative(DIST, f)}`)
  const found = readFileSync(f, 'utf8').match(/<link rel="canonical"[^>]*>/g) ?? []
  const want = expected.get(relative(DIST, f))
  if (want ? found.length !== 1 || found[0] !== want.replace(' />', '>') && found[0] !== want : found.length)
    errors.push(`Wrong canonical address on ${relative(DIST, f)}: ${found.join(' ') || 'none'}${want ? ` (expected ${want})` : ''}`)
}

// ---- 2. uploads nothing uses, and drafts hidden from the production website
// Only files the content refers to are published. Deleting a project in the editor leaves its
// images in the repository; they stay there (and in the editor's media library) but are never
// put on the website.
const keep = publishedMedia(PREVIEW)
for (const folder of ['media', 'files'].map((d) => join(DIST, d)).filter(existsSync))
  for (const f of walk(folder)) {
    const path = `/${relative(DIST, f).split('\\').join('/')}`
    if (!keep.has(path)) { rmSync(f); console.log(`Not published (no content uses it): ${path}`) }
  }
// Remove folders left empty, so not even the folder name of a draft or deleted project is published.
const prune = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) prune(join(dir, e.name)); if (dir !== DIST && !readdirSync(dir).length) rmSync(dir, { recursive: true }) }
const draftFiles = PREVIEW ? [] : [...new Set(drafts.flatMap((p) => [...mediaIn(p)]))].filter((m) => !keep.has(m))
for (const m of draftFiles) rmSync(join(DIST, m), { force: true })
prune(DIST)
if (!PREVIEW) {
  const built = walk(DIST).filter((f) => /\.(html|js|css|json|txt|xml)$/.test(f) && !f.startsWith(join(DIST, 'admin'))).map((f) => [f, readFileSync(f, 'utf8')])
  for (const d of drafts) {
    for (const needle of [d.title, `/${d.slug}`, ...draftFiles].filter(Boolean)) {
      const hit = built.find(([, text]) => text.includes(needle))
      if (hit) errors.push(`Draft "${d.slug}" was found in the production build (${relative(DIST, hit[0])}: "${needle}").`)
    }
    for (const m of draftFiles) if (existsSync(join(DIST, m))) errors.push(`Draft-only file is still in the production build: ${m}`)
  }
}

// ---- 2b. responsive images
// Smaller WebP copies of every published photo (see src/lib/image-variants.js). Made after the
// step above, so only photos the website uses get copies. The originals are not changed.
const photos = existsSync(join(DIST, 'media')) ? walk(join(DIST, 'media')).filter(isPhoto) : []
let copies = 0
for (const file of photos) {
  const path = `/${relative(DIST, file).split('\\').join('/')}`
  const { width } = await sharp(file).metadata()
  if (!width) { errors.push(`Could not read the size of ${path}`); continue }
  for (const w of widthsFor(width)) {
    await sharp(file).resize({ width: w }).webp({ quality: 82, effort: 5 }).toFile(join(DIST, variantPath(path, w)))
    copies++
  }
}

// ---- 3. the website editor (Sveltia CMS) at /admin
// Served from this website rather than a third-party CDN, at the exact version pinned in
// package.json (its download is checked against bun.lock). The page loads it with an integrity
// hash, so the browser refuses a file that differs from the one built here.
const CMS = 'node_modules/@sveltia/cms/dist'
const ADMIN = join(DIST, 'admin')
const CMS_VERSION = JSON.parse(readFileSync('node_modules/@sveltia/cms/package.json', 'utf8')).version
cpSync(CMS, ADMIN, { recursive: true, filter: (f) => !/\.(map|mjs)$/.test(f) })
const sri = (file) => `sha384-${createHash('sha384').update(readFileSync(file)).digest('base64')}`
const integrity = sri(join(CMS, 'sveltia-cms.js'))
// WebP converter for Safari (see src/admin/webp-fallback.js). Published from node_modules at the
// pinned versions, beside the editor, so no code is fetched from another website.
const VENDOR = join(ADMIN, 'vendor')
const WEBP = 'node_modules/@jsquash/webp'
for (const f of ['encode.js', 'meta.js', 'utils.js', 'LICENSE']) cpSync(join(WEBP, f), join(VENDOR, 'jsquash-webp', f))
cpSync(join(WEBP, 'codec/enc'), join(VENDOR, 'jsquash-webp/codec/enc'), { recursive: true, filter: (f) => !/\.d\.ts$|README/.test(f) })
cpSync('node_modules/wasm-feature-detect/dist/esm/index.js', join(VENDOR, 'wasm-feature-detect/index.js'))
// The encoder names its one dependency by package name; point it at the copy published here.
const encodeJs = join(VENDOR, 'jsquash-webp/encode.js')
const encodeSource = readFileSync(encodeJs, 'utf8')
if (!encodeSource.includes("from 'wasm-feature-detect'")) errors.push('The WebP converter has changed shape: update the copy step in scripts/postbuild.mjs.')
writeFileSync(encodeJs, encodeSource.replace("from 'wasm-feature-detect'", "from '../wasm-feature-detect/index.js'"))
cpSync('src/admin/webp-fallback.js', join(ADMIN, 'webp-fallback.js'))
for (const f of ['jsquash-webp/codec/enc/webp_enc.wasm', 'jsquash-webp/codec/enc/webp_enc_simd.wasm']) if (!existsSync(join(VENDOR, f))) errors.push(`The WebP converter is missing ${f}`)
// The editor holds a GitHub sign-in, so the page may only run code from this site and talk to
// GitHub and the sign-in helper (Sveltia CMS Authenticator on Cloudflare), which renews it. Also allowed, as data only: the editor's fonts (jsDelivr), GitHub's status page, and
// the editor's version number and interface wording for its pinned version (unpkg.com).
// Extra code the editor would fetch from unpkg.com is refused. 'wasm-unsafe-eval' lets the
// browser compile WebAssembly, which the WebP converter for Safari uses; it does not allow eval()
// or any other way of running text as JavaScript, and the converter itself is served from here.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' https://cdn.jsdelivr.net",
  "img-src 'self' blob: data: https://*.githubusercontent.com",
  "media-src 'self' blob: https://*.githubusercontent.com",
  `connect-src 'self' blob: data: https://api.github.com https://*.githubusercontent.com https://sveltia-cms-auth.zafranzak98.workers.dev https://www.githubstatus.com https://unpkg.com/@sveltia/cms/package.json https://unpkg.com/@sveltia/cms@${CMS_VERSION}/locales/`,
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')
writeFileSync(join(ADMIN, 'index.html'), `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${NOINDEX}
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />
    <meta name="referrer" content="no-referrer" />
    <title>Website editor · ${esc(siteName)}</title>
  </head>
  <body>
    <script src="/admin/webp-fallback.js" integrity="${sri('src/admin/webp-fallback.js')}" crossorigin="anonymous"></script>
    <script src="/admin/sveltia-cms.js" integrity="${integrity}" crossorigin="anonymous"></script>
  </body>
</html>
`)
if (!existsSync(join(ADMIN, 'config.yml'))) errors.push('The website editor is missing its settings: admin/config.yml')

// ---- project colours
// The same assignment the website uses. Fails the build, leaving the published site as it was,
// if no arrangement keeps neighbouring projects distinct, and double-checks every listing.
try {
  const colours = assignColours(live)
  for (const { name, items } of listings(live))
    for (let i = 1; i < items.length; i++) {
      const [a, b] = [colours.get(items[i - 1].slug), colours.get(items[i].slug)]
      if (tooSimilar(a, b)) errors.push(`Project colours: "${items[i - 1].slug}" (${a}) and "${items[i].slug}" (${b}) are neighbours on ${name}.`)
    }
  for (const { name, items } of listings(live)) {
    const last = items[items.length - 1]
    if (last && colours.get(last.slug) === FOOTER) errors.push(`Project colours: "${last.slug}" is the last project on ${name} and would be ${FOOTER}, the same as the footer.`)
  }
  const changed = live.filter((p) => colours.get(p.slug) !== p.opening_colour)
  console.log(`Project colours: ${live.map((p) => `${p.slug} ${colours.get(p.slug)}`).join(', ')}`)
  for (const p of changed) console.log(`  ${p.slug}: preferred ${p.opening_colour}, shown as ${colours.get(p.slug)} (keeps neighbours distinct, avoids the footer colour on the last project of a page, and avoids a repeat on its category page)`)
} catch (e) {
  errors.push(e.message)
}

// ---- 4. sizes
const MB = 1024 * 1024
const size = (dir) => walk(dir).reduce((n, f) => n + statSync(f).size, 0)
const siteSize = size(DIST)
let repoSize = 0
try { repoSize = Number(execSync('git count-objects -v', { encoding: 'utf8' }).match(/size-pack: (\d+)/)?.[1] ?? 0) * 1024 } catch {}
const biggest = walk('public').map((f) => [f, statSync(f).size]).sort((a, b) => b[1] - a[1])
for (const [f, s] of biggest) {
  if (s > 20 * MB) warnings.push(`${f} is ${(s / MB).toFixed(1)} MB. GitHub blocks files over 100 MB and warns from 50 MB.`)
  // Large screens are sent the original, so an image over 1 MB still slows the site down there.
  else if (s > MB && /\.(jpe?g|png|webp|gif)$/i.test(f)) warnings.push(`${f} is ${(s / MB).toFixed(1)} MB. Images over 1 MB slow the site down.`)
}
// The smaller copies made in section 2b are what most visitors download: none should be over 1 MB.
for (const f of walk(join(DIST, 'media')).filter((f) => /-w\d+\.webp$/.test(f))) {
  const s = statSync(f).size
  if (s > MB) warnings.push(`${relative(DIST, f)} (a smaller copy for visitors) is ${(s / MB).toFixed(1)} MB. Images over 1 MB slow the site down.`)
}
if (siteSize > 500 * MB) warnings.push(`The published website is ${(siteSize / MB).toFixed(0)} MB. GitHub Pages allows up to 1 GB.${siteSize > 800 * MB ? ' URGENT.' : ''}`)
if (repoSize > 500 * MB) warnings.push(`The repository is ${(repoSize / MB).toFixed(0)} MB. GitHub recommends staying under 1 GB.${repoSize > 800 * MB ? ' URGENT.' : ''}`)

const report = [
  `Mode: ${PREVIEW ? 'preview (drafts shown)' : 'production (drafts excluded)'}`,
  `Projects: ${live.length} built, ${PREVIEW ? 0 : drafts.length} draft(s) excluded`,
  `Responsive images: ${copies} smaller copies of ${photos.length} photos`,
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
