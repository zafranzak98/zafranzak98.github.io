import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createUsePuck } from '@puckeditor/core'
import { COLOURS, contrast, type Colour } from '#/layout/design'
import { SCREENS, TEXT_SIZES, lookAt, type TextSize, type ElementLook, type ElementStyle, type Elements, type Screen } from '#/layout/elements'
import type { Project } from '#/lib/site'
import { boxOf, clearGuides, describeSnap, drawGuides, linesFor, snap, type Box } from './guides'
import { LABELS, type LabelKey } from '#/layout/labels'

// Editing single elements on the page: click one to select it, double-click its words to change
// them, then style it in the "Selected element" panel or move it with the arrow keys.
//
// Changed words are kept in the page data (root.props.edits) until publishing, so undo, redo,
// drafts and unsaved-work recovery cover them; publishing writes them to the project's content file.
// Names use ':' and '-' rather than dots, because the editor reads dots in names as nested data.

const usePuck = createUsePuck()

export type Edits = Record<string, string>
type Selected = { key: string; blockId: string; field?: string } | null

const Selection = createContext<{ selected: Selected; select: (s: Selected) => void }>({ selected: null, select: () => {} })
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, select] = useState<Selected>(null)
  return <Selection.Provider value={{ selected, select }}>{children}</Selection.Provider>
}

const NAMES: [RegExp, string][] = [
  [/^title$/, 'Title'],
  [/^sub$/, 'Category and year line'],
  [/^line$/, 'Summary line'],
  [/^image$/, 'Opening image'],

  [/^lead$/, 'Opening paragraph'],
  [/^label-did$/, '"What I did" label'],
  [/^did$/, 'What I did'],
  [/^label-team$/, '"What the team did" label'],
  [/^team$/, 'What the team did'],
  [/^text$/, 'Research text'],
  [/^extra$/, 'Further research text'],
  [/^moodboard$/, 'Moodboard'],
  [/^key$/, 'Key image'],
  [/^key-caption$/, 'Key image caption'],
  [/^image-(\d+)$/, 'Image'],
  [/^caption-(\d+)$/, 'Image caption'],
  [/^context$/, 'Context image'],
  [/^context-text$/, 'Context text'],
  [/^film$/, 'Film'],
  [/^results-label$/, 'Results heading'],
  [/^figure-(\d+)$/, 'Figure'],
  [/^figure-label-(\d+)$/, 'Figure label'],
  [/^note$/, 'Note'],
  [/^skills-label$/, 'Skills heading'],
  [/^skills$/, 'Skills line'],
  [/^label$/, 'Label'],
  [/^kicker$/, 'Small label'],
  [/^heading$/, 'Heading'],
  [/^caption$/, 'Caption'],
]
const nameOf = (key: string) => {
  const fact = key.match(/^(label|value)-(role|type|when|deliverables|tools)$/)
  if (fact) return fact[1] === 'label' ? `"${LABELS[fact[2] as LabelKey]}" label` : `${LABELS[fact[2] as LabelKey]} fact`
  const match = NAMES.find(([re]) => re.test(key))
  const n = key.match(/(\d+)$/)
  return match ? `${match[1]}${n ? ` ${Number(n[1]) + 1}` : ''}` : key
}
const IMAGES = /^(image|image-\d+|moodboard|key|context|film)$/

// ---- Words

// Fields that show differently from how they are stored: lists, and "Type", which joins two fields.
const SEPARATOR: Record<string, string> = { skills: ' / ', deliverables: ', ', tools: ', ' }
type Get = (path: (string | number)[]) => unknown
const keysOf = (field: string) => field.split(':').map((k) => (/^\d+$/.test(k) ? Number(k) : k))
const fromObject = (obj: unknown): Get => (path) => path.reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj)

// The words a field shows, read with `get` from either the project or its content file.
export function wordsAt(field: string, get: Get) {
  const value = field === 'type' ? [get(['project_type']), get(['type_detail'])].filter(Boolean).join(' · ') : get(keysOf(field))
  if (Array.isArray(value)) return value.join(SEPARATOR[field] ?? ', ')
  if (value != null && value !== '') return String(value)
  return field.startsWith('labels:') ? LABELS[field.slice(7) as LabelKey] : ''
}
export const wordsOf = (p: Project, field: string, edits: Edits = {}) => (field in edits ? edits[field] : wordsAt(field, fromObject(p)))

// Where changed words are written: one or more paths in the content file and their values.
export function writesFor(field: string, words: string): [(string | number)[], unknown][] {
  if (field === 'type') {
    const [kind, ...detail] = words.split(' · ')
    return [[['project_type'], kind.trim()], [['type_detail'], detail.join(' · ').trim() || undefined]]
  }
  if (SEPARATOR[field]) return [[[field], words.split(SEPARATOR[field].trim()).map((s) => s.trim()).filter(Boolean)]]
  return [[keysOf(field), words]]
}

export function applyEdits(p: Project, edits: Edits = {}): Project {
  if (!Object.keys(edits).length) return p
  const copy = structuredClone(p) as Record<string, unknown>
  for (const [field, words] of Object.entries(edits)) {
    for (const [path, value] of writesFor(field, words)) {
      let target = copy as Record<string | number, unknown>
      for (const k of path.slice(0, -1)) target = (target[k] ??= {}) as Record<string | number, unknown>
      target[path[path.length - 1]] = value
    }
  }
  return copy as Project
}

// Words in your own blocks (fields starting "prop:") belong to the block itself; all other words
// belong to the project's content file and are kept as edits until publishing.
function useWords(p: Project) {
  const root = usePuck((s) => s.appState.data.root)
  const dispatch = usePuck((s) => s.dispatch)
  const getItemById = usePuck((s) => s.getItemById)
  const getSelectorForId = usePuck((s) => s.getSelectorForId)
  const edits = (root.props as { edits?: Edits })?.edits ?? {}
  const read = (field: string, blockId?: string) => {
    if (!field.startsWith('prop:')) return wordsOf(p, field, edits)
    return String((getItemById(blockId ?? '')?.props as Record<string, unknown> | undefined)?.[field.slice(5)] ?? '')
  }
  const write = (field: string, words: string, blockId?: string) => {
    if (field.startsWith('prop:')) {
      const item = getItemById(blockId ?? '')
      const at = getSelectorForId(blockId ?? '')
      if (!item || !at) return
      dispatch({ type: 'replace', destinationIndex: at.index, destinationZone: at.zone, data: { ...item, props: { ...item.props, [field.slice(5)]: words } } as never })
      return
    }
    const next = { ...edits }
    if (words === wordsOf(p, field)) delete next[field]
    else next[field] = words
    dispatch({ type: 'replaceRoot', root: { ...root, props: { ...root.props, edits: next } as never } })
  }
  return { read, write }
}

// ---- Arrow-key nudges reach the panel of the selected element through this small channel.

// Moves (by dragging the grip or with the arrow keys) reach the selected element's panel as its new
// position for the screen size being edited, in rem. Announcements go to the panel's live region.
const moveListeners = new Set<(x: number, y: number) => void>()
const announceListeners = new Set<(text: string) => void>()

// Snapping to guides is on unless switched off in the panel; holding Option (Alt) moves freely.
const SNAP_KEY = 'design-editor:snap'
export const snapOn = () => { try { return localStorage.getItem(SNAP_KEY) !== 'off' } catch { return true } }
export const setSnapOn = (on: boolean) => { try { localStorage.setItem(SNAP_KEY, on ? 'on' : 'off') } catch { /* stays on for this visit */ } }
const round = (n: number) => Math.round(n * 100) / 100
const shift = (b: Box, dx: number, dy: number): Box => ({ left: b.left + dx, right: b.right + dx, top: b.top + dy, bottom: b.bottom + dy, baseline: b.baseline === undefined ? undefined : b.baseline + dy })

// ---- On the page: selecting, editing words, nudging

export function useCanvasEditing(p: Project, edits: Edits) {
  // The page frame can be redrawn by the editor, so listen on whichever document holds it now.
  const [doc, setDoc] = useState<Document | null>(null)
  const anchor = (node: HTMLSpanElement | null) => setDoc(node?.ownerDocument ?? null)
  const { selected, select } = useContext(Selection)
  const words = useWords(p)
  const latest = useRef({ edits, words, selected })
  latest.current = { edits, words, selected }

  useEffect(() => {
    if (!doc) return
    // Puck switches off pointer events inside blocks while editing, so find the element by
    // position: the smallest marked element under the pointer.
    const elementAt = (e: MouseEvent) => {
      let best: HTMLElement | undefined
      let bestArea = Infinity
      for (const el of doc.querySelectorAll<HTMLElement>('[data-el]')) {
        const r = el.getBoundingClientRect()
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue
        if (r.width * r.height < bestArea) { best = el; bestArea = r.width * r.height }
      }
      return best
    }

    const mark = (el: HTMLElement | null) => {
      doc.querySelectorAll('[data-el-selected]').forEach((n) => n.removeAttribute('data-el-selected'))
      el?.setAttribute('data-el-selected', '')
    }

    const onClick = (e: MouseEvent) => {
      const el = elementAt(e)
      if (!el) return
      const blockId = el.closest('[data-puck-component]')?.getAttribute('data-puck-component') ?? ''
      select({ key: el.dataset.el!, blockId, field: el.dataset.edit })
      mark(el)
    }

    // Words are typed into a copy laid exactly over the element, in the same type, so the page
    // itself is only ever redrawn from the saved words.
    const onDoubleClick = (e: MouseEvent) => {
      const el = elementAt(e)
      if (!el?.dataset.edit) return
      e.preventDefault()
      const field = el.dataset.edit
      const r = el.getBoundingClientRect()
      const look = doc.defaultView!.getComputedStyle(el)
      const box = doc.createElement('div')
      box.className = 'el-typing'
      const blockId = el.closest('[data-puck-component]')?.getAttribute('data-puck-component') ?? ''
      box.textContent = latest.current.words.read(field, blockId)
      Object.assign(box.style, {
        left: `${r.left + doc.defaultView!.scrollX}px`, top: `${r.top + doc.defaultView!.scrollY}px`, width: `${Math.max(r.width, 120)}px`, minHeight: `${r.height}px`,
        font: look.font, letterSpacing: look.letterSpacing, textTransform: look.textTransform, lineHeight: look.lineHeight, color: look.color, textAlign: look.textAlign,
      })
      try { box.contentEditable = 'plaintext-only' } catch { box.contentEditable = 'true' }
      box.setAttribute('role', 'textbox')
      box.setAttribute('aria-label', 'Edit the words, then press Enter')
      el.setAttribute('data-el-editing', '')
      doc.body.append(box)
      box.focus()
      doc.getSelection()?.selectAllChildren(box)
      let done = false
      const finish = (keep: boolean) => {
        if (done) return
        done = true
        const words = (box.textContent ?? '').replace(/\s+/g, ' ').trim()
        box.remove()
        el.removeAttribute('data-el-editing')
        if (keep && words) latest.current.words.write(field, words, blockId)
      }
      box.addEventListener('keydown', (k) => {
        k.stopPropagation()
        if (k.key === 'Enter' && !k.shiftKey) { k.preventDefault(); finish(true) }
        if (k.key === 'Escape') { k.preventDefault(); finish(false) }
      })
      box.addEventListener('blur', () => finish(true))
    }

    // Where the selected element is now: its offset in pixels at this screen size.
    const offsetOf = (el: HTMLElement) => {
      const look = doc.defaultView!.getComputedStyle(el)
      return [parseFloat(look.left) || 0, parseFloat(look.top) || 0]
    }
    const rootSize = () => parseFloat(doc.defaultView!.getComputedStyle(doc.documentElement).fontSize) || 16
    // Screen pixels in the editor's (scaled) preview, as page pixels.
    const pagePixels = (px: number) => {
      const frame = doc.defaultView!.frameElement as HTMLElement | null
      const scale = frame ? frame.getBoundingClientRect().width / doc.documentElement.clientWidth : 1
      return px / (scale || 1)
    }
    const commit = (leftPx: number, topPx: number, words: string) => {
      const root = rootSize()
      moveListeners.forEach((fn) => fn(round(leftPx / root), round(topPx / root)))
      announceListeners.forEach((fn) => fn(words))
    }
    const selectedEl = () => doc.querySelector<HTMLElement>('[data-el-selected]')

    const onKeyDown = (e: KeyboardEvent) => {
      if (!latest.current.selected) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable]')) return
      const el = selectedEl()
      const step = (e.shiftKey ? 1 : 0.25) * rootSize()
      const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (!el || !move[e.key]) return
      e.preventDefault()
      let [dx, dy] = move[e.key]
      const [left, top] = offsetOf(el)
      // A gentle snap: only within a pixel or two of a guide, so the next key press moves on.
      const s = snapOn() && !e.altKey ? snap(shift(boxOf(el), dx, dy), linesFor(el, nameOf), pagePixels(2)) : { dx: 0, dy: 0 }
      if (!dx) { s.dx = 0; delete (s as { hitAcross?: unknown }).hitAcross }
      if (!dy) { s.dy = 0; delete (s as { hitDown?: unknown }).hitDown }
      dx += s.dx
      dy += s.dy
      if (s.dx || s.dy) { drawGuides(doc, s); setTimeout(() => clearGuides(doc), 900) }
      commit(left + dx, top + dy, describeSnap(s) || 'Moved.')
    }

    // Dragging the grip moves only the selected element; guides show what it lines up with.
    const onGripDown = (e: PointerEvent) => {
      const grip = (e.target as HTMLElement).closest('.el-grip') as HTMLElement | null
      const el = selectedEl()
      if (!grip || !el) return
      e.preventDefault()
      e.stopPropagation()
      grip.setPointerCapture(e.pointerId)
      const [left, top] = offsetOf(el)
      const start = boxOf(el)
      const lines = linesFor(el, nameOf)
      const [x0, y0] = [e.clientX, e.clientY]
      let last = { dx: 0, dy: 0, s: snap(start, { across: [], down: [] }, 0) }
      const onMove = (m: PointerEvent) => {
        let dx = m.clientX - x0
        let dy = m.clientY - y0
        // Snap only along a direction you are actually moving in, so a sideways drag never shifts it up or down.
        const s = snapOn() && !m.altKey ? snap(shift(start, dx, dy), lines, pagePixels(6)) : snap(start, { across: [], down: [] }, 0)
        if (Math.abs(dx) < pagePixels(3)) { s.dx = 0; s.hitAcross = undefined }
        if (Math.abs(dy) < pagePixels(3)) { s.dy = 0; s.hitDown = undefined }
        dx += s.dx
        dy += s.dy
        el.style.translate = `${dx}px ${dy}px`
        drawGuides(doc, s)
        last = { dx, dy, s }
      }
      const onUp = () => {
        grip.removeEventListener('pointermove', onMove)
        grip.removeEventListener('pointerup', onUp)
        grip.removeEventListener('pointercancel', onUp)
        el.style.translate = ''
        clearGuides(doc)
        if (last.dx || last.dy) commit(left + last.dx, top + last.dy, describeSnap(last.s) || 'Moved.')
      }
      grip.addEventListener('pointermove', onMove)
      grip.addEventListener('pointerup', onUp)
      grip.addEventListener('pointercancel', onUp)
    }

    doc.addEventListener('pointerdown', onGripDown, true)
    doc.addEventListener('click', onClick, true)
    doc.addEventListener('dblclick', onDoubleClick, true)
    doc.addEventListener('keydown', onKeyDown)
    if (doc !== document) document.addEventListener('keydown', onKeyDown)
    return () => {
      doc.removeEventListener('pointerdown', onGripDown, true)
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('dblclick', onDoubleClick, true)
      doc.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [doc, p, select])

  // Keep the outline and the grip on the selected element after the page redraws.
  useEffect(() => {
    if (!doc) return
    const el = selected && [...doc.querySelectorAll<HTMLElement>('[data-el]')].find((n) => n.dataset.el === selected.key && n.closest('[data-puck-component]')?.getAttribute('data-puck-component') === selected.blockId)
    doc.querySelectorAll('[data-el-selected]').forEach((n) => n !== el && n.removeAttribute('data-el-selected'))
    let grip = doc.querySelector<HTMLElement>('.el-grip')
    if (!el) { grip?.remove(); return }
    el.setAttribute('data-el-selected', '')
    if (!grip) {
      grip = doc.createElement('div')
      grip.className = 'el-grip'
      grip.title = 'Drag to move this element (hold Option to move freely)'
      grip.setAttribute('aria-hidden', 'true')
      doc.body.append(grip)
    }
    const r = el.getBoundingClientRect()
    const view = doc.defaultView!
    Object.assign(grip.style, { left: `${r.left + view.scrollX - 26}px`, top: `${r.top + view.scrollY - 2}px` })
  })

  return anchor
}

// ---- The "Selected element" panel

const SCREEN_WIDTH: Record<Screen, number> = { desktop: 1440, tablet: 1024, phone: 390 }
const SCREEN_LABEL: Record<Screen, string> = { desktop: 'Desktop', tablet: 'Tablet', phone: 'Phone' }
const screenFor = (width: number): Screen => (width >= 1280 ? 'desktop' : width >= 900 ? 'tablet' : 'phone')
const SPACING = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]

export function ElementPanel({ value, onChange, p }: { value: Elements | undefined; onChange: (v: Elements) => void; p: Project }) {
  const { selected } = useContext(Selection)
  const item = usePuck((s) => s.selectedItem)
  const ui = usePuck((s) => s.appState.ui)
  const dispatch = usePuck((s) => s.dispatch)
  const words = useWords(p)
  const screen = screenFor(Number(ui.viewports.current.width) || 1440)
  const key = selected && item && selected.blockId === item.props.id ? selected.key : null
  const style: ElementStyle = (key && value?.[key]) || {}
  const own = style[screen] ?? {}
  const shown = lookAt(style, screen)

  const setLook = (patch: Partial<ElementLook>) => {
    if (!key) return
    const next = { ...own, ...patch }
    for (const k of Object.keys(next) as (keyof ElementLook)[]) if (next[k] === undefined) delete next[k]
    const nextStyle = { ...style, [screen]: next }
    if (!Object.keys(next).length) delete nextStyle[screen]
    const all = { ...(value ?? {}), [key]: nextStyle }
    if (!Object.keys(nextStyle).length) delete all[key]
    onChange(all)
  }
  const latest = useRef(setLook)
  latest.current = setLook
  const [message, setMessage] = useState('')
  const [snapping, setSnapping] = useState(snapOn)
  useEffect(() => {
    const onMove = (x: number, y: number) => latest.current({ x, y })
    moveListeners.add(onMove)
    announceListeners.add(setMessage)
    return () => { moveListeners.delete(onMove); announceListeners.delete(setMessage) }
  }, [])

  // Text colours are checked against the block's background (Off-white unless the block sets one).
  const background = ((item?.props as { design?: { background?: Colour } })?.design?.background ?? 'Off-white') as Colour
  const ratio = key && shown.colour && !IMAGES.test(key) ? contrast(shown.colour, background) : null
  const hardToRead = ratio !== null && ratio < 4.5

  if (!key) return <p className="el-hint">Click a heading, number, label or image on the page to change it on its own. Double-click words to edit them.</p>

  const isImage = IMAGES.test(key)
  const showScreen = (s: Screen) => dispatch({ type: 'setUi', ui: { viewports: { ...ui.viewports, current: { width: SCREEN_WIDTH[s], height: 'auto' } } } })
  const inherited = (k: keyof ElementLook) => own[k] === undefined && shown[k] !== undefined && screen !== 'desktop'

  return (
    <div className="el-panel">
      <p className="el-name">{nameOf(key)}</p>
      <div className="el-screens" role="group" aria-label="Screen size these settings apply to">
        {SCREENS.map((s) => <button key={s} type="button" aria-pressed={s === screen} onClick={() => showScreen(s)}>{SCREEN_LABEL[s]}</button>)}
      </div>
      <p className="el-note">{screen === 'desktop' ? 'Tablet and Phone follow these settings unless you change them there.' : `Settings not changed here follow ${screen === 'tablet' ? 'Desktop' : 'Tablet'}.`}</p>

      {selected?.field && (
        <label className="el-row">Words
          <textarea rows={2} value={words.read(selected.field, selected.blockId)} onChange={(e) => words.write(selected.field!, e.target.value, selected.blockId)} />
        </label>
      )}

      <fieldset className="el-row">
        <legend>Move (without moving anything else)</legend>
        <Stepper label="Left or right" value={shown.x ?? 0} onChange={(x) => setLook({ x })} inherited={inherited('x')} />
        <Stepper label="Up or down" value={shown.y ?? 0} onChange={(y) => setLook({ y })} inherited={inherited('y')} />
        <p className="el-note">Drag the grip beside it, or use the arrow keys (Shift for bigger steps). Hold Option to move freely.</p>
        <label className="el-switch"><input type="checkbox" checked={snapping} onChange={(e) => { setSnapOn(e.target.checked); setSnapping(e.target.checked) }} /> Snap to guides</label>
        <p className="el-live" role="status" aria-live="polite">{message}</p>
      </fieldset>

      <Choice label="Space above" value={own.above} options={SPACING.map((s) => [s, `${s} rem`])} onChange={(above) => setLook({ above })} inherited={inherited('above')} />
      <Choice label="Space below" value={own.below} options={SPACING.map((s) => [s, `${s} rem`])} onChange={(below) => setLook({ below })} inherited={inherited('below')} />
      {isImage ? (
        <>
          <Choice label="Width" value={own.width} options={[40, 50, 60, 70, 80, 90, 100].map((w) => [w, `${w}%`])} onChange={(width) => setLook({ width })} inherited={inherited('width')} />
          <Choice label="Crop focus across" value={own.focusX} options={[0, 25, 50, 75, 100].map((v) => [v, `${v}%`])} onChange={(focusX) => setLook({ focusX })} inherited={inherited('focusX')} />
          <Choice label="Crop focus down" value={own.focusY} options={[0, 25, 50, 75, 100].map((v) => [v, `${v}%`])} onChange={(focusY) => setLook({ focusY })} inherited={inherited('focusY')} />
        </>
      ) : (
        <>
          <Choice label="Alignment" value={own.align} options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} onChange={(align) => setLook({ align })} inherited={inherited('align')} />
          <Choice label="Text size" value={own.size} options={(Object.keys(TEXT_SIZES) as TextSize[]).map((k) => [k, TEXT_SIZES[k][0]])} onChange={(size) => setLook({ size })} inherited={inherited('size')} />
          <Choice label="Weight" value={own.weight} options={[[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold']]} onChange={(weight) => setLook({ weight })} inherited={inherited('weight')} />
          <Choice label="Colour" value={own.colour} options={COLOURS.map((c) => [c, c])} onChange={(colour) => setLook({ colour })} inherited={inherited('colour')} />
          {hardToRead && <p className="editor-warning-text" role="note">{shown.colour} on {background} is hard to read ({ratio.toFixed(1)}:1; 4.5:1 is the minimum for text). Choose another colour or background.</p>}
        </>
      )}
      <button type="button" className="el-reset" onClick={() => setLook(Object.fromEntries(Object.keys(own).map((k) => [k, undefined])))}>Reset {SCREEN_LABEL[screen]} settings</button>
    </div>
  )
}


function Stepper({ label, value, onChange, inherited }: { label: string; value: number; onChange: (v: number) => void; inherited: boolean }) {
  return (
    <div className="el-stepper">
      <span>{label}{inherited && <small> (following a larger size)</small>}</span>
      <button type="button" aria-label={`${label}: less`} onClick={() => onChange(round(value - 0.25))}>−</button>
      <output>{value} rem</output>
      <button type="button" aria-label={`${label}: more`} onClick={() => onChange(round(value + 0.25))}>+</button>
    </div>
  )
}

function Choice<T extends string | number>({ label, value, options, onChange, inherited }: { label: string; value: T | undefined; options: [T, string][]; onChange: (v: T | undefined) => void; inherited: boolean }) {
  return (
    <label className="el-row">{label}{inherited && <small> (following a larger size)</small>}
      <select value={value === undefined ? '' : String(value)} onChange={(e) => {
        const picked = options.find(([v]) => String(v) === e.target.value)
        onChange(picked ? picked[0] : undefined)
      }}>
        <option value="">As designed</option>
        {options.map(([v, text]) => <option key={String(v)} value={String(v)}>{text}</option>)}
      </select>
    </label>
  )
}
