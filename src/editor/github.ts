// Saving layouts to the repository, with the same sign-in and the same permissions as the
// website editor (Sveltia): the Sveltia CMS Authenticator on the site owner's Cloudflare account
// returns a GitHub sign-in for this repository only. The editor writes only under content/layouts,
// so the build guard treats every publish exactly like a website editor save.
//
//   Save draft  -> branch "design-drafts": nothing is published.
//   Publish     -> main: the normal build, checks and publish run, and a failed check
//                  publishes nothing.
//   History     -> every published version of the page, from the save history of main.

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

// Writes the layout. `sha` is the version this edit started from; if someone else saved in the
// meantime GitHub refuses (409), so nothing is overwritten unseen.
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

// Going back to the standard layout removes the saved file; its history stays in the repository.
export async function removeLayout(token: string, slug: string, message: string) {
  const current = await readLayout(token, slug, MAIN)
  if (!current) return
  await api(token, `/contents/${layoutPath(slug)}`, { method: 'DELETE', body: JSON.stringify({ message, branch: MAIN, sha: current.sha }) })
}
