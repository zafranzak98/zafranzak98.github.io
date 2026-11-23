import { useContext, useEffect, useRef, useState } from 'react'
import { createUsePuck } from '@puckeditor/core'
import { colourOf, highlightOnSage, type Project } from '#/lib/site'
import { checkPage, noteId, type CheckOptions, type Finding } from './checks'
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
        <button type="button" className={`editor-quiet editor-notes-btn${count ? ' has-notes' : ''}`} aria-expanded={open} onClick={() => setOpen(!open)}>
          {count ? `${count} layout ${count === 1 ? 'note' : 'notes'}` : 'Layout notes'}
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
          {count > 0 && <p className="editor-notes-intro">Advice only: nothing has been changed. Fix it, or mark it as intended.</p>}
          <ul>
            {notes.map((f) => (
              <li key={noteId(f)}>
                <span><b>{f.screen}:</b> {f.text}</span>
                <span className="editor-notes-actions">
                  <button type="button" onClick={() => show(f)}>Show</button>
                  <button type="button" onClick={() => setIntended([...intended, { id: noteId(f), text: `${f.screen}: ${f.text}` }])}>This is intended</button>
                </span>
              </li>
            ))}
          </ul>
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
