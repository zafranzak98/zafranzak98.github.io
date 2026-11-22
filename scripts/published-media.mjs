// Which files in public/media and public/files the website publishes: those the content uses.
// In production, media used only by draft projects is left out. Shared by scripts/postbuild.mjs
// (which removes everything else from the build) and vite.config.ts (which lists photo widths for
// responsive images), so a draft's file name can never reach the production website.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'

export const mediaIn = (value, out = new Set()) => {
  if (typeof value === 'string') { if (value.startsWith('/media/') || value.startsWith('/files/')) out.add(value) }
  else if (Array.isArray(value)) value.forEach((v) => mediaIn(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => mediaIn(v, out))
  return out
}

export function publishedMedia(preview) {
  const dir = 'content/projects'
  const projects = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => matter(readFileSync(join(dir, f), 'utf8')).data)
  const live = projects.filter((p) => preview || p.status !== 'Draft')
  const about = matter(readFileSync('content/about.md', 'utf8')).data
  const siteText = readFileSync('content/site.yml', 'utf8')
  return new Set([...live.flatMap((p) => [...mediaIn(p)]), ...mediaIn(about), ...(siteText.match(/\/(media|files)\/[^\s"']+/g) ?? [])])
}
