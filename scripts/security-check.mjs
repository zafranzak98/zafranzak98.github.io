// Security check: known problems in the packages the website is built with, from `bun audit`.
// It never stops a publish. Moderate or worse problems become warnings (emailed once, when they
// change); low ones are listed in the build summary only.
import { execSync } from 'node:child_process'

const RANK = { low: 0, moderate: 1, high: 2, critical: 3 }

export function summarise(report) {
  const found = Object.entries(report).map(([name, advisories]) => {
    const worst = advisories.map((a) => a.severity).sort((a, b) => RANK[b] - RANK[a])[0] ?? 'low'
    return { name, worst }
  })
  const serious = found.filter((f) => RANK[f.worst] >= RANK.moderate).sort((a, b) => RANK[b.worst] - RANK[a.worst] || a.name.localeCompare(b.name))
  const minor = found.filter((f) => RANK[f.worst] < RANK.moderate)
  return {
    warning: serious.length ? `Security check: ${serious.length} package${serious.length > 1 ? 's' : ''} with known problems: ${serious.map((f) => `${f.name} (${f.worst})`).join(', ')}. Run "bun audit" for details; updating usually fixes it.` : '',
    note: minor.length ? `Security check: ${minor.length} low-severity notice${minor.length > 1 ? 's' : ''} (${minor.map((f) => f.name).join(', ')}).` : `Security check: no known problems.`,
  }
}

export function securityCheck() {
  let output
  try {
    output = execSync('bun audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch (e) {
    output = e.stdout // bun audit exits with an error when it finds problems; its report is still printed
  }
  try {
    return summarise(JSON.parse(output || ''))
  } catch {
    return { warning: '', note: 'Security check: could not run this time (the advisory service did not answer). It runs again on the next build.' }
  }
}
