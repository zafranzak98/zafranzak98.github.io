import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createUsePuck } from '@puckeditor/core'
import { COLOURS } from '#/layout/design'
import { SCREENS, TEXT_SIZES, lookAt, type TextSize, type ElementLook, type ElementStyle, type Elements, type Screen } from '#/layout/elements'
import type { Project } from '#/lib/site'

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
  [/^title$/, 'Section title'],
  [/^results-label$/, 'Results heading'],
  [/^figure-(\d+)$/, 'Figure $1'],
  [/^figure-label-(\d+)$/, 'Figure $1 label'],
  [/^note$/, 'Outcome note'],
  [/^skills-label$/, 'Skills heading'],
  [/^skills$/, 'Skills line'],
  [/^image$/, 'Opening image'],
]
const nameOf = (key: string) => {
  for (const [re, name] of NAMES) if (re.test(key)) return key.replace(re, name).replace(/Figure (\d+)/, (_, n) => `Figure ${Number(n) + 1}`)
  return key
}

// ---- Words

const DEFAULTS: Record<string, string> = { outcomes_title: 'Outcomes', skills_label: 'Skills shown' }

function getPath(obj: unknown, path: string): unknown {
  return path.split(':').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj)
}

// The words as they are written in the content file, for editing.
export function wordsFromValue(field: string, value: unknown) {
  if (Array.isArray(value)) return value.join(' / ')
  return value == null || value === '' ? (DEFAULTS[field] ?? '') : String(value)
}
export function wordsOf(p: Project, field: string, edits: Edits = {}) {
  return field in edits ? edits[field] : wordsFromValue(field, getPath(p, field))
}

// Lists written as "A / B / C" go back into the file as separate entries.
export const toFileValue = (field: string, words: string) => (field === 'skills' ? words.split('/').map((s) => s.trim()).filter(Boolean) : words)

export function applyEdits(p: Project, edits: Edits = {}): Project {
  if (!Object.keys(edits).length) return p
  const copy = structuredClone(p) as Record<string, unknown>
  for (const [field, words] of Object.entries(edits)) {
    const keys = field.split(':')
    let target = copy as Record<string, unknown>
    for (const k of keys.slice(0, -1)) target = target[k] as Record<string, unknown>
    if (target) target[keys[keys.length - 1]] = toFileValue(field, words)
  }
  return copy as Project
}

function useSetWords(p: Project) {
  const root = usePuck((s) => s.appState.data.root)
  const dispatch = usePuck((s) => s.dispatch)
  return (field: string, words: string) => {
    const edits = { ...((root.props as { edits?: Edits })?.edits ?? {}) }
    if (words === wordsOf(p, field)) delete edits[field]
    else edits[field] = words
    dispatch({ type: 'replaceRoot', root: { ...root, props: { ...root.props, edits } as never } })
  }
}

// ---- Arrow-key nudges reach the panel of the selected element through this small channel.

const nudgeListeners = new Set<(dx: number, dy: number) => void>()

// ---- On the page: selecting, editing words, nudging

export function useCanvasEditing(p: Project, edits: Edits) {
  // The page frame can be redrawn by the editor, so listen on whichever document holds it now.
  const [doc, setDoc] = useState<Document | null>(null)
  const anchor = (node: HTMLSpanElement | null) => setDoc(node?.ownerDocument ?? null)
  const { selected, select } = useContext(Selection)
  const setWords = useSetWords(p)
  const latest = useRef({ edits, setWords, selected })
  latest.current = { edits, setWords, selected }

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
      box.textContent = wordsOf(p, field, latest.current.edits)
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
        if (keep && words) latest.current.setWords(field, words)
      }
      box.addEventListener('keydown', (k) => {
        k.stopPropagation()
        if (k.key === 'Enter' && !k.shiftKey) { k.preventDefault(); finish(true) }
        if (k.key === 'Escape') { k.preventDefault(); finish(false) }
      })
      box.addEventListener('blur', () => finish(true))
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (!latest.current.selected) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable]')) return
      const step = e.shiftKey ? 1 : 0.25
      const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (!move[e.key]) return
      e.preventDefault()
      nudgeListeners.forEach((fn) => fn(...move[e.key]))
    }

    doc.addEventListener('click', onClick, true)
    doc.addEventListener('dblclick', onDoubleClick, true)
    doc.addEventListener('keydown', onKeyDown)
    if (doc !== document) document.addEventListener('keydown', onKeyDown)
    return () => {
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('dblclick', onDoubleClick, true)
      doc.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [doc, p, select])

  // Keep the outline on the selected element after the page redraws.
  useEffect(() => {
    if (!doc || !selected) return
    const el = [...doc.querySelectorAll<HTMLElement>('[data-el]')].find((n) => n.dataset.el === selected.key && n.closest('[data-puck-component]')?.getAttribute('data-puck-component') === selected.blockId)
    if (el && !el.hasAttribute('data-el-selected')) {
      doc.querySelectorAll('[data-el-selected]').forEach((n) => n.removeAttribute('data-el-selected'))
      el.setAttribute('data-el-selected', '')
    }
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
  const root = usePuck((s) => s.appState.data.root)
  const dispatch = usePuck((s) => s.dispatch)
  const setWords = useSetWords(p)
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
  const position = useRef(shown)
  position.current = shown
  useEffect(() => {
    const fn = (dx: number, dy: number) => latest.current({ x: round((position.current.x ?? 0) + dx), y: round((position.current.y ?? 0) + dy) })
    nudgeListeners.add(fn)
    return () => { nudgeListeners.delete(fn) }
  }, [])

  if (!key) return <p className="el-hint">Click a heading, number, label or image on the page to change it on its own. Double-click words to edit them.</p>

  const edits = (root.props as { edits?: Edits })?.edits ?? {}
  const isImage = key === 'image'
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
          <textarea rows={2} value={wordsOf(p, selected.field, edits)} onChange={(e) => setWords(selected.field!, e.target.value)} />
        </label>
      )}

      <fieldset className="el-row">
        <legend>Move (without moving anything else)</legend>
        <Stepper label="Left or right" value={shown.x ?? 0} onChange={(x) => setLook({ x })} inherited={inherited('x')} />
        <Stepper label="Up or down" value={shown.y ?? 0} onChange={(y) => setLook({ y })} inherited={inherited('y')} />
        <p className="el-note">Arrow keys move it too (Shift for bigger steps).</p>
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
        </>
      )}
      <button type="button" className="el-reset" onClick={() => setLook(Object.fromEntries(Object.keys(own).map((k) => [k, undefined])))}>Reset {SCREEN_LABEL[screen]} settings</button>
    </div>
  )
}

const round = (n: number) => Math.round(n * 100) / 100

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
