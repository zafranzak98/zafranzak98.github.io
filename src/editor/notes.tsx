import { useContext, useEffect, useRef, useState } from 'react'
import { createUsePuck } from '@puckeditor/core'
import { colourOf, highlightOnSage, type Project } from '#/lib/site'
import { checkPage, noteId, type CheckOptions, type Finding } from './checks'
import { SCREENS, type ElementStyle, type Elements } from '#/layout/elements'
import { Selection, nameOf } from './elements'

// Layout notes: while you edit, the page at the screen size you are working on is checked quietly
// for parts you changed that run off the screen, overlap, stick out of their section, are cut off,
// are too small or hard to read. Notes are advice only: nothing is moved or blocked. "This is
// intended" silences one note for one part at one screen size; that choice is saved with the page,
// listed under the notes, and can be reversed.
//
// Desktop changes also apply to Tablet and Phone unless something was set there separately, so after
// a Desktop change a one-line reminder offers to check those two sizes (on request, never in the
// background).

const usePuck = createUsePuck()

export type Intended = { id: string; text: string }
const SIZES: [string, number][] = [['Tablet', 1024], ['Phone', 390]]
const SCREEN_WIDTH: Record<string, number> = { Desktop: 1440, Tablet: 1024, Phone: 390 }
export const canvasDoc = () => (document.getElementById('preview-frame') as HTMLIFrameElement | null)?.contentDocument ?? null
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Measurements are only right once the typeface and the images have arrived.
export async function settled(doc: Document) {
  await Promise.race([doc.fonts?.ready, wait(1500)])
  const pending = [...doc.images].filter((i) => !i.complete)
  await Promise.race([Promise.all(pending.map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }) }))), wait(1500)])
}

// The approved exception (22 Nov 2026): on pages whose opening is Sage without the Light sage
// highlight (AF-Binary, Evoke), small text sits directly on Sage at about 4.27:1. That is a decision,
// not a problem, so it is never reported there.
export const checkOptions = (p: Project): CheckOptions => ({
  approvedContrast: (el, ratio) => colourOf(p) === 'Sage' && !highlightOnSage(p) && ratio >= 4.2 && !!el.closest('.cs-open, .band'),
})

export function LayoutNotes({ p, screen, preview, checkSizes }: { p: Project; screen: string; preview: boolean; checkSizes: (sizes: [string, number][]) => Promise<Finding[]> }) {
  const data = usePuck((s) => s.appState.data)
  const dispatch = usePuck((s) => s.dispatch)
  const ui = usePuck((s) => s.appState.ui)
  const { select } = useContext(Selection)
  const root = (data.root.props ?? {}) as Record<string, unknown>
  const intended = (Array.isArray(root.intended) ? root.intended : []) as Intended[]
  const [live, setLive] = useState<Finding[]>([])
  const [others, setOthers] = useState<Finding[]>([])
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState(false)
  const [checking, setChecking] = useState(false)
  const [said, setSaid] = useState('')
  const announced = useRef(new Set<string>())
  // The page without the notes' own record, so marking something intended does not count as a change.
  const { intended: _ignored, ...rest } = root
  const shape = JSON.stringify([data.content, data.zones, rest])
  const previous = useRef(shape)

  // A change made at Desktop also reaches Tablet and Phone: remind once, until checked or dismissed.
  useEffect(() => {
    if (previous.current === shape) return
    previous.current = shape
    if (screen === 'Desktop') setHint(true)
  }, [shape, screen])

  // Check the screen size being edited, a moment after the last change, never mid-drag or mid-typing.
  useEffect(() => {
    if (preview) return
    let stop = false
    let timer = 0
    const run = async () => {
      const doc = canvasDoc()
      if (!doc || stop) return
      const html = doc.documentElement
      if (html.hasAttribute('data-el-typing') || doc.querySelector('[data-moving]')) { timer = window.setTimeout(run, 500); return }
      await settled(doc)
      if (stop) return
      const t0 = performance.now()
      const found = checkPage(doc, screen, nameOf, checkOptions(p))
      html.dataset.layoutCheckMs = (performance.now() - t0).toFixed(1)
      html.dataset.layoutChecks = String(Number(html.dataset.layoutChecks ?? 0) + 1)
      setLive(found)
    }
    timer = window.setTimeout(run, 700)
    return () => { stop = true; window.clearTimeout(timer) }
  }, [shape, screen, preview, p])

  const silenced = new Set(intended.map((i) => i.id))
  const current = live.filter((f) => !silenced.has(noteId(f)))
  const elsewhere = others.filter((f) => f.screen !== screen && !silenced.has(noteId(f)))
  const notes = [...current, ...elsewhere]
  const problems = notes.filter((f) => !f.advice)
  const suggested = notes.filter((f) => f.advice)

  // Mark the parts with notes on the page, faintly; only at the size being edited.
  useEffect(() => {
    const doc = canvasDoc()
    if (!doc) return
    const mark = new Set(current.map((f) => `${f.blockId}|${f.key}`))
    doc.querySelectorAll<HTMLElement>('[data-el]').forEach((el) => {
      const id = `${el.closest('[data-puck-component]')?.getAttribute('data-puck-component')}|${el.dataset.el}`
      el.toggleAttribute('data-el-note', mark.has(id))
    })
  })

  // Tell screen readers about new notes once; never repeat a note already announced.
  useEffect(() => {
    const fresh = current.filter((f) => !announced.current.has(noteId(f)))
    fresh.forEach((f) => announced.current.add(noteId(f)))
    if (fresh.length) setSaid(fresh.length === 1 ? `Layout note: ${fresh[0].text}` : `${fresh.length} new layout notes.`)
  }, [current.map(noteId).join()])

  // A suggestion's fix, applied only when chosen: one change at the size it was found, one step to undo.
  const getItemById = usePuck((s) => s.getItemById)
  const getSelectorForId = usePuck((s) => s.getSelectorForId)
  const applyFix = (f: Finding) => {
    const fix = f.fix
    const doc = canvasDoc()
    const item = f.blockId ? getItemById(f.blockId) : undefined
    const at = f.blockId ? getSelectorForId(f.blockId) : undefined
    if (!fix || !doc || !item || !at || !f.key) return
    const size = SCREENS[['Desktop', 'Tablet', 'Phone'].indexOf(f.screen)]
    const rem = parseFloat(doc.defaultView!.getComputedStyle(doc.documentElement).fontSize) || 16
    const el = [...doc.querySelectorAll<HTMLElement>('[data-el]')].find((n) => n.dataset.el === f.key && n.closest('[data-puck-component]')?.getAttribute('data-puck-component') === f.blockId)
    const o = el ? doc.defaultView!.getComputedStyle(el) : null
    const [x, y] = o ? [parseFloat(o.left) || 0, parseFloat(o.top) || 0] : [0, 0]
    const r16 = (n: number) => Math.round(n * 16) / 16
    const all = ((item.props as { elements?: Elements }).elements ?? {}) as Elements
    const style: ElementStyle = all[f.key] ?? {}
    const look = { ...(style[size] ?? {}) }
    if (fix.back) { look.x = 0; look.y = 0 }
    if (fix.dx) look.x = r16((x + fix.dx) / rem)
    if (fix.dy) look.y = r16((y + fix.dy) / rem)
    // A part that sits where designed needs no setting at this size, unless a larger size moved it.
    const larger = SCREENS.slice(0, SCREENS.indexOf(size)).some((s2) => style[s2]?.x || style[s2]?.y)
    if (!larger) { if (!look.x) delete look.x; if (!look.y) delete look.y }
    const next: ElementStyle = { ...style, [size]: look }
    if (!Object.keys(look).length) delete next[size]
    const elements = { ...all, [f.key]: next }
    if (!Object.keys(next).length) delete elements[f.key]
    dispatch({ type: 'replace', destinationIndex: at.index, destinationZone: at.zone, data: { ...item, props: { ...item.props, elements } } as never })
    setSaid(`${fix.label}: done. Undo puts it back.`)
  }
  const setIntended = (next: Intended[]) =>
    dispatch({ type: 'replaceRoot', root: { ...data.root, props: { ...root, intended: next } } as never })
  const show = async (f: Finding) => {
    setOpen(false)
    if (f.screen !== screen) {
      dispatch({ type: 'setUi', ui: { viewports: { ...ui.viewports, current: { width: SCREEN_WIDTH[f.screen], height: 'auto' } } } })
      await wait(700)
    }
    const el = [...(canvasDoc()?.querySelectorAll<HTMLElement>('[data-el]') ?? [])].find((n) => n.dataset.el === f.key && n.closest('[data-puck-component]')?.getAttribute('data-puck-component') === f.blockId)
    if (el && f.key && f.blockId) { el.scrollIntoView({ block: 'center' }); select({ key: f.key, blockId: f.blockId, field: el.dataset.edit }) }
  }
  const checkOthers = async () => {
    setHint(false)
    setChecking(true)
    const found = await checkSizes(SIZES)
    setOthers(found)
    setChecking(false)
    setOpen(true)
    setSaid(found.length ? `Tablet and Phone checked: ${found.length} ${found.length === 1 ? 'note' : 'notes'}.` : 'Tablet and Phone checked: no layout notes.')
  }

  // Close the list with Escape or a click elsewhere.
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !(e.target as HTMLElement).closest('.editor-notes')) setOpen(false) }
    document.addEventListener('keydown', close)
    document.addEventListener('pointerdown', close)
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close) }
  }, [open])

  if (preview) return null
  const count = notes.length
  return (
    <div className="editor-notes">
      {(count > 0 || intended.length > 0) && (
        <button type="button" className={`editor-quiet editor-notes-btn${problems.length ? ' has-notes' : suggested.length ? ' has-advice' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
          {[problems.length && `${problems.length} layout ${problems.length === 1 ? 'note' : 'notes'}`, suggested.length && `${suggested.length} ${suggested.length === 1 ? 'suggestion' : 'suggestions'}`].filter(Boolean).join(' · ') || 'Layout notes'}
        </button>
      )}
      {hint && !checking && (
        <span className="editor-notes-hint">
          Desktop changes also apply to Tablet and Phone, unless set there separately.{' '}
          <button type="button" onClick={checkOthers}>Check Tablet and Phone</button>
          <button type="button" aria-label="Dismiss" title="Dismiss" onClick={() => setHint(false)}>✕</button>
        </span>
      )}
      {checking && <span className="editor-notes-hint" role="status">Checking Tablet and Phone…</span>}
      {open && (
        <div className="editor-notes-list" role="group" aria-label="Layout notes">
          {count === 0 && <p className="editor-notes-empty">No layout notes. Everything you changed fits.</p>}
          {count > 0 && <p className="editor-notes-intro">Advice only: nothing changes unless you choose a fix. Fix it, or mark it as intended.</p>}
          {([['Problems', notes.filter((f) => !f.advice)], ['Suggestions', notes.filter((f) => f.advice)]] as const).map(([title, list]) => list.length > 0 && (
            <section key={title} aria-label={title}>
              {problems.length > 0 && suggested.length > 0 && <h3 className="editor-notes-head">{title}</h3>}
              <ul>
                {list.map((f) => (
                  <li key={noteId(f)}>
                    <span><b>{f.screen}:</b> {f.text}</span>
                    <span className="editor-notes-actions">
                      <button type="button" onClick={() => show(f)}>Show</button>
                      {f.fix && f.screen === screen && <button type="button" onClick={() => applyFix(f)}>{f.fix.label}</button>}
                      <button type="button" onClick={() => setIntended([...intended, { id: noteId(f), text: `${f.screen}: ${f.text}` }])}>This is intended</button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {intended.length > 0 && (
            <details className="editor-notes-intended">
              <summary>Marked as intended ({intended.length})</summary>
              <ul>
                {intended.map((i) => (
                  <li key={i.id}>
                    <span>{i.text}</span>
                    <button type="button" onClick={() => setIntended(intended.filter((x) => x.id !== i.id))}>Show this note again</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">{said}</span>
    </div>
  )
}
