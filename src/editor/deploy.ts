// After publishing: follows the website update until the new version is live, or it fails.
//
// Live means the website itself now serves the new version: every build writes the version it was
// made from to /version.json, which the editor reads from the same website (no sign-in, no GitHub
// limit). GitHub's public record of the update run (no sign-in needed, this repository is public)
// says whether it is waiting, running or has failed. Nothing here can change the website.

const API = 'https://api.github.com/repos/zafranzak98/zafranzak98.github.io'
const EVERY = 5_000 // how often the website is asked which version it serves
const RUN_EVERY = 3 // GitHub is asked about the update run every third time (every 15 seconds)
const SLOW = 3 * 60_000 // later than this is unusual (updates take about a minute)
const GIVE_UP = 10 * 60_000
// How GitHub reports an update that did not finish. A cancelled update is not a failure: it was
// replaced by a later one, which includes this change.
const FAILED = ['failure', 'timed_out', 'startup_failure', 'action_required']

export type Update =
  | { state: 'waiting' } // GitHub has not started the update yet
  | { state: 'updating' }
  | { state: 'slow' }
  | { state: 'live'; seconds: number }
  | { state: 'failed'; link: string }
  | { state: 'unknown' } // no answer after ten minutes: the change is saved, the website may still update

const get = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store', headers: url.startsWith(API) ? { Accept: 'application/vnd.github+json' } : {} })
  return res.ok ? res.json() : null
}

export function followUpdate(commit: string, show: (u: Update) => void): () => void {
  const start = Date.now()
  let stopped = false
  let polls = 0
  let runLink = `https://github.com/zafranzak98/zafranzak98.github.io/actions`
  let askGitHub = true // stops asking if GitHub limits requests without a sign-in
  let before: string | undefined // the version the website served when following started
  let compared: string | undefined

  const check = async () => {
    if (stopped) return
    polls++
    const elapsed = Date.now() - start
    try {
      const served = (await get(`/version.json?t=${Date.now()}`))?.commit as string | undefined
      // Live: the website serves this version, or a later one that includes it (two quick publishes
      // are built together, so the first one's own update is replaced by the second's).
      let live = served === commit
      before ??= served
      // GitHub is asked only once for each newer version the website starts serving.
      if (!live && served && served !== before && served !== compared && askGitHub) {
        compared = served
        const compare = await get(`${API}/compare/${commit}...${served}`)
        live = compare?.status === 'ahead'
      }
      if (live) { stopped = true; show({ state: 'live', seconds: Math.round(elapsed / 1000) }); return }
      if (askGitHub && polls % RUN_EVERY === 1) {
        const res = await fetch(`${API}/actions/runs?head_sha=${commit}&per_page=1`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } })
        if (res.status === 403 || res.status === 429) askGitHub = false
        const run = res.ok ? (await res.json()).workflow_runs?.[0] : undefined
        if (run?.html_url) runLink = run.html_url
        if (run?.status === 'completed' && FAILED.includes(run.conclusion)) { stopped = true; show({ state: 'failed', link: runLink }); return }
        if (!run || run.status === 'queued' || run.status === 'waiting' || run.status === 'pending') { if (elapsed < SLOW) show({ state: 'waiting' }) }
        else if (elapsed < SLOW) show({ state: 'updating' })
      }
    } catch { /* a missed answer is asked again next time */ }
    if (elapsed >= GIVE_UP) { stopped = true; show({ state: 'unknown' }); return }
    if (elapsed >= SLOW) show({ state: 'slow' })
    setTimeout(check, EVERY)
  }
  setTimeout(check, EVERY)
  return () => { stopped = true }
}
