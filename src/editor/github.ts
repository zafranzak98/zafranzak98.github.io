// Saving layouts to the repository, with the same sign-in and the same permissions as the
// website editor (Sveltia): the Sveltia CMS Authenticator on the site owner's Cloudflare account
// returns a GitHub sign-in for this repository only. The editor writes only under content/layouts,
// so the build guard treats every publish exactly like a website editor save.
//
//   Save draft  -> branch "design-drafts": nothing is published.
//   Publish     -> main: the normal build, checks and publish run, and a failed check
//                  publishes nothing.
//   History     -> every published version of the page, from the save history of main.

import { parseDocument } from 'yaml'
import { toFileValue, wordsFromValue, type Edits } from './elements'

const OWNER = 'zafranzak98'
const REPO = 'zafranzak98.github.io'
const AUTH = 'https://sveltia-cms-auth.zafranzak98.workers.dev'
export const MAIN = 'main'
export const DRAFTS = 'design-drafts'
export const layoutPath = (slug: string) => `content/layouts/${slug}.json`

// Opens the sign-in window and waits for the authenticator's reply. The authenticator only
// releases a sign-in to pages served from the site's own addresses.
export function signIn(): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(`${AUTH}/auth?provider=github&site_id=${encodeURIComponent(location.hostname)}`, 'design-sign-in', 'width=600,height=700')
    if (!popup) return reject(new Error('The sign-in window was blocked. Allow pop-ups for this site and try again.'))
    const onMessage = ({ data, origin, source }: MessageEvent) => {
      if (origin !== new URL(AUTH).origin || typeof data !== 'string') return
      if (data === 'authorizing:github') { (source as Window).postMessage(data, origin); return }
      const match = data.match(/^authorization:github:(success|error):(.+)$/s)
      if (!match) return
      window.removeEventListener('message', onMessage)
      const content = JSON.parse(match[2])
      if (match[1] === 'success' && content.token) resolve(content.token)
      else reject(new Error(content.error ?? 'Sign-in failed.'))
    }
    window.addEventListener('message', onMessage)
  })
}

async function api(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...init,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...init.headers },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub answered ${res.status}: ${(await res.json().catch(() => ({}))).message ?? res.statusText}`)
  return res.json()
}

// Text <-> base64 for the GitHub contents API, keeping accents and symbols intact.
const toBase64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)))
const fromBase64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)))

export type Saved = { layout: unknown; sha: string } | null

export async function readLayout(token: string, slug: string, ref: string): Promise<Saved> {
  const file = await api(token, `/contents/${layoutPath(slug)}?ref=${encodeURIComponent(ref)}`)
  return file ? { layout: JSON.parse(fromBase64(file.content)), sha: file.sha } : null
}

// Creates the drafts branch from main the first time a draft is saved.
async function ensureDrafts(token: string) {
  if (await api(token, `/branches/${DRAFTS}`)) return
  const main = await api(token, `/git/ref/heads/${MAIN}`)
  await api(token, '/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${DRAFTS}`, sha: main.object.sha }) })
}

// Writes the layout over the branch's current copy; every save stays in the branch history.
export async function writeLayout(token: string, slug: string, layout: unknown, branch: string, message: string) {
  if (branch === DRAFTS) await ensureDrafts(token)
  const current = await readLayout(token, slug, branch)
  return api(token, `/contents/${layoutPath(slug)}`, {
    method: 'PUT',
    body: JSON.stringify({ message, branch, content: toBase64(`${JSON.stringify(layout, null, 2)}\n`), ...(current && { sha: current.sha }) }),
  })
}

// Every published version of a page's layout, newest first.
export async function history(token: string, slug: string) {
  const commits = (await api(token, `/commits?sha=${MAIN}&path=${encodeURIComponent(layoutPath(slug))}&per_page=30`)) ?? []
  return commits.map((c: { sha: string; commit: { message: string; author: { date: string } } }) => ({ sha: c.sha, date: c.commit.author.date, message: c.commit.message }))
}

// The latest saved draft, if one was saved after the drafts branch was made.
export async function latestDraft(token: string, slug: string) {
  const [last] = (await api(token, `/commits?sha=${DRAFTS}&path=${encodeURIComponent(layoutPath(slug))}&per_page=1`)) ?? []
  if (!last?.commit.message.startsWith('Design editor: draft')) return null
  return { sha: last.sha as string, date: last.commit.author.date as string, message: 'Latest draft' }
}

// Going back to the standard layout removes the saved file; its history stays in the repository.
export async function removeLayout(token: string, slug: string, message: string) {
  const current = await readLayout(token, slug, MAIN)
  if (!current) return
  await api(token, `/contents/${layoutPath(slug)}`, { method: 'DELETE', body: JSON.stringify({ message, branch: MAIN, sha: current.sha }) })
}

// Writes changed words into the project's content file on main, the file the website editor
// (Sveltia) also edits. Each changed field is compared with what the editor started from: if
// someone has changed the same words in the website editor since, nothing is written.
export async function writeWords(token: string, slug: string, edits: Edits, startedWith: (field: string) => string) {
  const path = `content/projects/${slug}.md`
  const file = await api(token, `/contents/${path}?ref=${MAIN}`)
  if (!file) throw new Error('The project file was not found.')
  const text = fromBase64(file.content)
  const parts = text.match(/^---\n([\s\S]*?\n)---\n?([\s\S]*)$/)
  if (!parts) throw new Error('The project file is not in the expected format.')
  const doc = parseDocument(parts[1])
  const keysOf = (field: string) => field.split(':').map((k) => (/^\d+$/.test(k) ? Number(k) : k))
  const clashes = Object.keys(edits).filter((field) => {
    const node = doc.getIn(keysOf(field))
    const now = wordsFromValue(field, node && typeof node === 'object' && 'toJSON' in node ? (node as { toJSON: () => unknown }).toJSON() : node)
    return now !== startedWith(field) && now !== edits[field]
  })
  const describe = (field: string) => {
    const [name, index, part] = field.split(':')
    if (name === 'results') return `figure ${Number(index) + 1}${part === 'label' ? ' label' : ''}`
    return ({ outcomes_title: 'the Outcomes title', results_label: 'the results heading', outcome_note: 'the outcome note', skills_label: 'the skills heading', skills: 'the skills line' } as Record<string, string>)[name] ?? name
  }
  if (clashes.length) throw new Error(`These words were changed in the website editor after this page was opened: ${clashes.map(describe).join(', ')}. Nothing was saved. Reload the editor to see that change, then make yours again.`)
  for (const [field, words] of Object.entries(edits)) doc.setIn(keysOf(field), doc.createNode(toFileValue(field, words)))
  const updated = `---\n${doc.toString({ lineWidth: 0 })}---\n${parts[2]}`
  if (updated === text) return false
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ message: `Design editor: words for ${slug}`, branch: MAIN, content: toBase64(updated), sha: file.sha }),
  })
  if (res.status === 409) throw new Error('The project file changed a moment ago. Nothing was saved; publish again.')
  if (!res.ok) throw new Error(`GitHub answered ${res.status}. Nothing was saved.`)
  return true
}
