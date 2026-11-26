import { useEffect, useId, useMemo, useState } from 'react'
import { createUsePuck } from '@puckeditor/core'
import imageWidths from 'virtual:image-widths'
import { asset, projects, type Project } from '#/lib/site'
import { applyEdits, useWords, wordsOf, type Edits } from './elements'

const usePuck = createUsePuck()

// Visual editor demo: page settings that are words, not looks. They are kept with the page's other
// changed words (root.props.edits) until publishing, so Undo, Redo, drafts and recovery cover them.
//   Homepage clock: clock:show, clock:city, clock:time_zone, clock:line (the same four settings, with
//     the same rules, as Site settings > Homepage clock in the website editor and the build check).
//   About portrait: portrait:image (a photo already on the site) and portrait:alt (its description).
// Its looks (width per screen size, crop focus) are the portrait's element settings, like any image.

// The same rule as the website editor's pattern and the build's check (scripts/postbuild.mjs).
const ZONE_PATTERN = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/
export function validTimeZone(zone: string) {
  if (!ZONE_PATTERN.test(zone)) return false
  try { new Intl.DateTimeFormat('en-GB', { timeZone: zone }); return true } catch { return false }
}

type Words = Record<string, unknown> & { clock?: { show?: unknown; weather?: unknown; city: string; time_zone: string; line?: string }; portrait?: { image?: string; alt?: string } }

// The words a page shows with your changes. The clock's "show" is kept as words ("true"/"false") and
// shown as a switch; a time zone that is not valid yet keeps showing the last valid one, so the
// canvas never breaks while you type.
export function wordsWithEdits(words: Words, edits: Edits): Words {
  const out = applyEdits(words as never, edits) as unknown as Words
  if (!out.clock) return out
  const zone = validTimeZone(out.clock.time_zone) ? out.clock.time_zone : words.clock!.time_zone
  return { ...out, clock: { ...out.clock, show: String(out.clock.show) !== 'false', weather: String(out.clock.weather) === 'true', time_zone: zone } }
}

export type Problem = { text: string; section: string; key: string }
// What stops a page from being published, in plain words. The same reasons the build would refuse
// (time zone), and the ones that keep the site accessible (a photo's description).
export function pageProblems(words: Words, edits: Edits): Problem[] {
  const now = applyEdits(words as never, edits) as unknown as Words
  const out: Problem[] = []
  if (now.clock && String(now.clock.show) !== 'false' && !now.clock.city.trim()) out.push({ text: 'The homepage clock has no city. Add one in the clock settings, or hide the clock.', section: 'HomeClock', key: 'clock' })
  // The build checks the time zone even when the clock is hidden, so publishing does too.
  if (now.clock) {
    if (!validTimeZone(now.clock.time_zone)) out.push({ text: `The homepage clock's time zone "${now.clock.time_zone}" is not a real time zone. Use a name such as Europe/London or Asia/Kuala_Lumpur.`, section: 'HomeClock', key: 'clock' })
  }
  if (now.portrait?.image && !now.portrait.alt?.trim()) out.push({ text: 'The About portrait has no description. Add one in the portrait’s settings: screen readers read it to visitors who cannot see the photo.', section: 'AboutHero', key: 'portrait' })
  return out
}

// The rules the website's build applies to words (content-collections.ts). Publishing words that break
// one would stop the website updating, so they are caught here first, with the reason.
const TYPES = ['Individual project', 'Team project (lead)', 'Team project (member)', 'Freelance', 'University project', 'Personal project']
export function wordProblems(edits: Edits, caseStudy: boolean): Problem[] {
  const out: Problem[] = []
  const len = (field: string) => (edits[field] ?? '').trim().length
  const check = (field: string, ok: boolean, text: string, section: string, key: string) => { if (field in edits && !ok) out.push({ text, section, key }) }
  if (caseStudy) {
    check('title', len('title') >= 1 && len('title') <= 60, 'The project title needs between 1 and 60 characters.', 'Opening', 'title')
    check('summary', len('summary') >= 1 && len('summary') <= 220, 'The summary needs between 1 and 220 characters.', 'Opening', 'summary')
    check('role', len('role') >= 1 && len('role') <= 60, 'My role needs between 1 and 60 characters.', 'Facts', 'value-role')
    check('when', len('when') >= 1, 'When needs some words.', 'Facts', 'value-when')
    check('type', TYPES.includes((edits.type ?? '').split(' · ')[0].trim()), `The project type must start with one of: ${TYPES.join(', ')}.`, 'Facts', 'value-type')
    check('homepage_label', len('homepage_label') <= 70, 'The homepage label can have up to 70 characters.', 'Opening', 'title')
  }
  for (const field of Object.keys(edits).filter((f) => /^category:/.test(f))) {
    const n = edits[field].trim().length
    if (n < 1 || n > 40) out.push({ text: 'A category name needs between 1 and 40 characters.', section: 'ListingHead', key: 'title' })
  }
  return out
}

// ---- Homepage clock

// withLine: false where the line's words are already shown above (the clock's own Settings).
export function ClockSettings({ p, withLine = true }: { p: Project; withLine?: boolean }) {
  const words = useWords(p)
  const id = useId()
  const show = words.read('clock:show') !== 'false'
  const city = words.read('clock:city')
  const zone = words.read('clock:time_zone')
  const line = words.read('clock:line')
  const weather = words.read('clock:weather') === 'true'
  const zoneOk = validTimeZone(zone)
  const zones = useMemo(() => { try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone') } catch { return [] } }, [])
  const [now, setNow] = useState('')
  useEffect(() => {
    if (!zoneOk) { setNow(''); return }
    const tick = () => setNow(new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()))
    tick()
    const t = window.setInterval(tick, 15000)
    return () => window.clearInterval(t)
  }, [zone, zoneOk])
  return (
    <section className="el-group ps-group" aria-label="Clock settings">
      <h3>Clock<span className="el-group-detail"> · settings</span></h3>
      <p className="el-note">The local time beside the introduction. It follows daylight saving by itself. These are the same settings as Homepage clock in the website editor.</p>
      <label className="ps-check"><input type="checkbox" checked={show} onChange={(e) => words.write('clock:show', String(e.target.checked))} /> Show the clock</label>
      <label className="ps-field" htmlFor={`${id}-city`}>City</label>
      <input id={`${id}-city`} className="el-words" value={city} aria-invalid={show && !city.trim()} aria-describedby={`${id}-city-note`} onChange={(e) => words.write('clock:city', e.target.value)} />
      <p id={`${id}-city-note`} className={show && !city.trim() ? 'el-warning' : 'el-note'}>{show && !city.trim() ? 'Add a city, or hide the clock. Publishing waits until then.' : 'The place named after the time, for example Harrogate.'}</p>
      <label className="ps-field" htmlFor={`${id}-zone`}>Time zone</label>
      <input id={`${id}-zone`} className="el-words" list={`${id}-zones`} value={zone} spellCheck={false} autoComplete="off" aria-invalid={!zoneOk} aria-describedby={`${id}-zone-note`} onChange={(e) => words.write('clock:time_zone', e.target.value.trim())} />
      <datalist id={`${id}-zones`}>{zones.map((z) => <option key={z} value={z} />)}</datalist>
      <p id={`${id}-zone-note`} className={zoneOk ? 'el-note' : 'el-warning'} role={zoneOk ? undefined : 'alert'}>
        {zoneOk ? `Valid. It is ${now} there now.` : 'Not a real time zone. Use a name such as Europe/London or Asia/Kuala_Lumpur. The page keeps the last valid one, and publishing waits until this is fixed.'}
      </p>
      <label className="ps-check"><input type="checkbox" checked={weather} disabled={!show} onChange={(e) => words.write('clock:weather', String(e.target.checked))} /> Show the weather beside the time</label>
      <p className="el-note">The temperature and a small icon, updated for visitors every 15 minutes. Here the editor shows a sample. The weather is for the place set as the clock's location in the website editor (Site settings, Homepage clock); if you change the city, change the location there too.</p>
      {withLine && (
        <>
          <label className="ps-field" htmlFor={`${id}-line`}>Line under the time</label>
          <input id={`${id}-line`} className="el-words" value={line} onChange={(e) => words.write('clock:line', e.target.value)} />
          <p className="el-note">For example "A mind full of ideas, always." Leave it empty for none. You can also type it on the page.</p>
        </>
      )}
    </section>
  )
}

// ---- About portrait

// Every photo already on the site (uploading new ones stays in the website editor).
export const sitePhotos = () => Object.keys(imageWidths).filter((path) => path.startsWith('/media/') && !/-w\d+\.webp$/.test(path)).sort()
// Each photo is named by where it is used, never by its file name: "About" or the project's own title,
// numbered within it ("AF-Binary, photo 3").
const photoNames = (paths: string[]) => {
  const count: Record<string, number> = {}
  return Object.fromEntries(paths.map((path) => {
    const folder = path.startsWith('/media/about/') ? 'About' : (projects.find((x) => x.slug === path.split('/')[3])?.title ?? 'Site photo')
    count[folder] = (count[folder] ?? 0) + 1
    return [path, `${folder}, photo ${count[folder]}`]
  }))
}

export function PortraitContent({ p }: { p: Project }) {
  const words = useWords(p)
  const root = usePuck((s) => s.appState.data.root)
  const dispatch = usePuck((s) => s.dispatch)
  const id = useId()
  const image = words.read('portrait:image')
  // Another photo needs its own description, so choosing one empties it (one change, one Undo step).
  // Going back to the published photo brings back its published description.
  const choose = (path: string) => {
    if (path === image) return
    const next = { ...((root.props as { edits?: Edits })?.edits ?? {}) }
    if (path === wordsOf(p, 'portrait:image')) { delete next['portrait:image']; delete next['portrait:alt'] }
    else { next['portrait:image'] = path; next['portrait:alt'] = '' }
    dispatch({ type: 'replaceRoot', root: { ...root, props: { ...root.props, edits: next } } as never })
  }
  const alt = words.read('portrait:alt')
  const photos = useMemo(sitePhotos, [])
  const names = useMemo(() => photoNames(photos), [photos])
  return (
    <section className="el-group ps-group" aria-label="Content: Portrait">
      <h3>Content<span className="el-group-detail"> · Portrait</span></h3>
      <div className="el-row">
        <div className="el-row-head"><span>Photo</span></div>
        <p className="el-note">Choose from the photos already on your site; a new choice needs its own description. To add a new photo, upload it in the website editor (/admin, Media) first.</p>
        <div className="ps-photos" role="radiogroup" aria-label="Portrait photo">
          {photos.map((path) => (
            <button key={path} type="button" role="radio" aria-checked={path === image} className="ps-photo" title={names[path]} onClick={() => choose(path)}>
              <img src={asset(path)} alt="" loading="lazy" />
              <span className="ps-photo-name">{names[path]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="el-row">
        <div className="el-row-head"><label htmlFor={`${id}-alt`}>Description (required)</label></div>
        <textarea id={`${id}-alt`} className="el-words" rows={2} value={alt} aria-invalid={!alt.trim()} aria-describedby={`${id}-alt-note`} onChange={(e) => words.write('portrait:alt', e.target.value.replace(/\n/g, ' '))} />
        <p id={`${id}-alt-note`} className={alt.trim() ? 'el-note' : 'el-warning'} role={alt.trim() ? undefined : 'alert'}>{alt.trim() ? 'Read aloud to visitors who cannot see the photo.' : 'Describe the photo. Publishing waits until it has a description.'}</p>
      </div>
    </section>
  )
}

// The portrait's width as a share of the page width, per screen size (the approved size is the default).
export const PORTRAIT_WIDTH = { desktop: [14, 19.5, 24], tablet: [14, 19.5, 24], phone: [28, 36, 44] } as const
