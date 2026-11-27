// One GitHub sign-in for both editors in this browser.
//
// The website editor (Sveltia, at /admin) keeps its sign-in in this browser's storage under
// "sveltia-cms.user". The design editor reads only the access token from it, so signing in to
// either editor signs you in to both. It never reads, changes or uses the renewal key stored
// beside it: Sveltia renews the sign-in itself whenever /admin is open.
//
// If that entry is missing, expired or not in the shape expected (for example after a Sveltia
// update), the design editor signs in on its own instead, and keeps that sign-in only until the
// tab closes. Signing out removes both, which signs you out of both editors in this browser.
// It does not cancel the sign-in at GitHub: to do that, revoke the app in GitHub, Settings,
// Applications, "Zafran website editor (Sveltia CMS)".

export const SHARED_KEY = 'sveltia-cms.user'
const OWN_KEY = 'design-editor:token'

export type Account = { token: string; shared: boolean }

// GitHub tokens are letters, digits and underscores after a short gh?_ prefix.
const looksLikeToken = (t: unknown): t is string => typeof t === 'string' && /^gh[a-z]_[A-Za-z0-9_]{20,255}$/.test(t)

// The access token from Sveltia's entry, or null when there is none or it looks different.
export function sharedToken(raw: string | null = read(SHARED_KEY, localStorage)): string | null {
  if (!raw) return null
  try {
    const entry = JSON.parse(raw) as { backendName?: unknown; token?: unknown }
    return entry && entry.backendName === 'github' && looksLikeToken(entry.token) ? entry.token : null
  } catch {
    return null
  }
}

export function ownToken(): string | null {
  const t = read(OWN_KEY, sessionStorage)
  return looksLikeToken(t) ? t : null
}

// The sign-in to use now: the shared one first, unless GitHub has already refused it.
export function currentAccount(refused?: string | null): Account | null {
  const shared = sharedToken()
  if (shared && shared !== refused) return { token: shared, shared: true }
  const own = ownToken()
  return own && own !== refused ? { token: own, shared: false } : null
}

// A sign-in GitHub has refused (expired, usually). Remembered for this tab, so changing page in the
// editor does not offer it again; a renewed shared sign-in is a different token and is used at once.
const REFUSED_KEY = 'design-editor:refused'
export const refusedToken = () => read(REFUSED_KEY, sessionStorage)
export const keepRefused = (token: string | null) => (token ? write(REFUSED_KEY, token, sessionStorage) : remove(REFUSED_KEY, sessionStorage))

export const keepOwn = (token: string) => write(OWN_KEY, token, sessionStorage)
export const forgetOwn = () => remove(OWN_KEY, sessionStorage)

// Signs out of both editors in this browser.
export function signOutHere() {
  forgetOwn()
  remove(SHARED_KEY, localStorage)
}

// Storage can be switched off or full; the editor then simply asks you to sign in.
function read(key: string, store: Storage) { try { return store.getItem(key) } catch { return null } }
function write(key: string, value: string, store: Storage) { try { store.setItem(key, value) } catch { /* lasts until the page closes */ } }
function remove(key: string, store: Storage) { try { store.removeItem(key) } catch { /* nothing kept */ } }
