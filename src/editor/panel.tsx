import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createUsePuck } from '@puckeditor/core'
import { COLOURS, contrast, type Colour } from '#/layout/design'
import { SCREENS, TEXT_SIZES, lookAt, type ElementLook, type ElementStyle, type Elements, type Screen, type TextSize } from '#/layout/elements'
import type { Project } from '#/lib/site'
import { IMAGES, Selection, widthNow, announceListeners, moveListeners, nameOf, round, setSnapOn, snapOn, useWords, widthListeners } from './elements'

// The editing controls: the side panel for the selected element or section, and a small toolbar
// that floats above the selected element. Both change the same settings, per screen size.

const usePuck = createUsePuck()

const SCREEN_WIDTH: Record<Screen, number> = { desktop: 1440, tablet: 1024, phone: 390 }
const SCREEN_LABEL: Record<Screen, string> = { desktop: 'Desktop', tablet: 'Tablet', phone: 'Phone' }
const screenFor = (width: number): Screen => (width >= 1280 ? 'desktop' : width >= 900 ? 'tablet' : 'phone')
const SIZES = Object.keys(TEXT_SIZES) as TextSize[]
const SPACING = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]
const SWATCH: Record<Colour, string> = { Olive: 'var(--olive)', Sage: 'var(--sage)', 'Light sage': 'var(--lsage)', 'Off-white': 'var(--off)', Terracotta: 'var(--terra)' }
const WEIGHTS: [ElementLook['weight'], string][] = [[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold']]
const px = (rem: number) => `${Math.round(rem * 16)} px`

export const canvas = () => (document.getElementById('preview-frame') as HTMLIFrameElement | null)?.contentDocument ?? null
const selectedEl = () => canvas()?.querySelector<HTMLElement>('[data-el-selected]') ?? null

// The selected element's settings at the screen size being edited, and a way to change them.
function useLook(value: Elements | undefined, onChange: (v: Elements) => void) {
  const { selected } = useContext(Selection)
  const item = usePuck((s) => s.selectedItem)
  const ui = usePuck((s) => s.appState.ui)
  const dispatch = usePuck((s) => s.dispatch)
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
  const showScreen = (s: Screen) => dispatch({ type: 'setUi', ui: { viewports: { ...ui.viewports, current: { width: SCREEN_WIDTH[s], height: 'auto' } } } })
  // Set here, or following a larger screen size.
  const from = (k: keyof ElementLook) => (own[k] !== undefined ? 'here' : shown[k] !== undefined ? 'larger' : 'design')
  const background = ((item?.props as { design?: { background?: Colour } })?.design?.background ?? 'Off-white') as Colour
  return { key, item, selected, screen, own, shown, setLook, showScreen, from, background }
}

// The text size an element shows now, as the nearest step on the site's type scale.
function currentSize(look: ElementLook): number {
  if (look.size) return SIZES.indexOf(look.size)
  const el = selectedEl()
  const doc = canvas()
  if (!el || !doc) return SIZES.indexOf('body')
  const probe = doc.createElement('span')
  doc.body.append(probe)
  const actual = parseFloat(getComputedStyle(el).fontSize)
  let best = 0
  let gap = Infinity
  SIZES.forEach((s, i) => {
    probe.style.fontSize = TEXT_SIZES[s][1]
    const d = Math.abs(parseFloat(doc.defaultView!.getComputedStyle(probe).fontSize) - actual)
    if (d < gap) { gap = d; best = i }
  })
  probe.remove()
  return best
}

// Puck draws its field panel in more than one place (wide and narrow layouts), so the panel can be
// mounted twice. Only one copy listens to moves and shows the toolbar, so each change is made once.
let owner: symbol | null = null
function useOwner() {
  const [me] = useState(() => Symbol('panel'))
  const [mine, setMine] = useState(false)
  useEffect(() => {
    if (!owner) owner = me
    setMine(owner === me)
    return () => { if (owner === me) owner = null }
  }, [me])
  return mine
}

// ---- The side panel: a custom field on every block with single elements.

export function ElementPanel({ value, onChange, p }: { value: Elements | undefined; onChange: (v: Elements) => void; p: Project }) {
  const look = useLook(value, onChange)
  const { select } = useContext(Selection)
  const { key, item, selected, screen, own, shown, setLook, showScreen, from, background } = look
  const words = useWords(p)
  const latest = useRef(setLook)
  latest.current = setLook
  const [message, setMessage] = useState('')
  const [snapping, setSnapping] = useState(snapOn)
  const mine = useOwner()
  useEffect(() => {
    if (!mine) return
    const onMove = (x: number, y: number) => latest.current({ x, y })
    const onWidth = (width: number) => latest.current({ width })
    moveListeners.add(onMove)
    widthListeners.add(onWidth)
    announceListeners.add(setMessage)
    return () => { moveListeners.delete(onMove); widthListeners.delete(onWidth); announceListeners.delete(setMessage) }
  }, [mine])
  useEffect(() => setMessage(''), [key])

  if (!key) return <Parts blockId={item?.props.id as string | undefined} />

  const isImage = IMAGES.test(key)
  const el = selectedEl()
  const width = shown.width ?? (el ? widthNow(el) : 100)
  const ratio = shown.colour && !isImage ? contrast(shown.colour, background) : null
  const changed = Object.keys(own).length > 0
  const reset = (...keys: (keyof ElementLook)[]) => setLook(Object.fromEntries(keys.map((k) => [k, undefined])))

  return (
    <div className="el-panel">
      <div className="el-head">
        <p className="el-name">{nameOf(key)}</p>
        <button type="button" className="el-link" onClick={() => select(null)}>Back to section</button>
      </div>
      <Segments label="Changes apply to" value={screen} options={SCREENS.map((s) => [s, SCREEN_LABEL[s]])} onChange={showScreen} />
      <p className="el-note">{screen === 'desktop' ? 'Tablet and Phone follow Desktop unless you change them there.' : `Anything not changed here follows ${screen === 'tablet' ? 'Desktop' : 'Tablet'}.`}</p>

      {selected?.field && (
        <Group title="Words">
          <textarea className="el-words" rows={2} aria-label="Words" value={words.read(selected.field, selected.blockId)} onChange={(e) => words.write(selected.field!, e.target.value, selected.blockId)} />
          <p className="el-note">Or double-click the words on the page.</p>
        </Group>
      )}

      {isImage ? (
        <Group title="Image">
          <Row label="Width" from={from('width')} onReset={() => reset('width')}>
            <input type="range" min={20} max={100} step={5} value={width} aria-label="Width" aria-valuetext={`${width}%`} onChange={(e) => setLook({ width: Number(e.target.value) })} />
            <output>{width}%</output>
          </Row>
          <Row label="Crop focus" from={from('focusX') === 'design' ? from('focusY') : from('focusX')} onReset={() => reset('focusX', 'focusY')}>
            <FocusGrid x={shown.focusX ?? 50} y={shown.focusY ?? 50} onChange={(focusX, focusY) => setLook({ focusX, focusY })} />
          </Row>
        </Group>
      ) : (
        <Group title="Text">
          <Row label="Size" from={from('size')} onReset={() => reset('size')}>
            <Step label="Size" text={shown.size ? TEXT_SIZES[shown.size][0] : 'As designed'} onLess={() => setLook({ size: SIZES[Math.max(0, currentSize(shown) - 1)] })} onMore={() => setLook({ size: SIZES[Math.min(SIZES.length - 1, currentSize(shown) + 1)] })} />
          </Row>
          <Row label="Weight" from={from('weight')} onReset={() => reset('weight')}>
            <Segments label="Weight" value={shown.weight} options={WEIGHTS as [number, string][]} onChange={(weight) => setLook({ weight: weight as ElementLook['weight'] })} small />
          </Row>
          <Row label="Colour" from={from('colour')} onReset={() => reset('colour')}>
            <Swatches value={shown.colour} onChange={(colour) => setLook({ colour })} />
          </Row>
          {ratio !== null && ratio < 4.5 && <p className="el-warning" role="note">{shown.colour} on {background} is hard to read ({ratio.toFixed(1)}:1; text needs at least 4.5:1). Choose another colour.</p>}
          <Row label="Alignment" from={from('align')} onReset={() => reset('align')}>
            <Segments label="Alignment" value={shown.align} options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} onChange={(align) => setLook({ align: align as ElementLook['align'] })} small />
          </Row>
        </Group>
      )}

      <Group title="Position">
        <Row label="Across" from={from('x')} onReset={() => reset('x')}>
          <Step label="Across" text={px(shown.x ?? 0)} onLess={() => setLook({ x: round((shown.x ?? 0) - 0.25) })} onMore={() => setLook({ x: round((shown.x ?? 0) + 0.25) })} />
        </Row>
        <Row label="Down" from={from('y')} onReset={() => reset('y')}>
          <Step label="Down" text={px(shown.y ?? 0)} onLess={() => setLook({ y: round((shown.y ?? 0) - 0.25) })} onMore={() => setLook({ y: round((shown.y ?? 0) + 0.25) })} />
        </Row>
        <p className="el-note">Drag it on the page, or use the arrow keys (Shift for bigger steps). Moving it never moves anything else. Hold Option to move without snapping.</p>
        <label className="el-switch"><input type="checkbox" checked={snapping} onChange={(e) => { setSnapOn(e.target.checked); setSnapping(e.target.checked) }} /> Snap to alignment guides</label>
        <p className="el-live" role="status" aria-live="polite">{message}</p>
      </Group>

      <Group title="Spacing">
        <Row label="Space above" from={from('above')} onReset={() => reset('above')}>
          <Step label="Space above" text={shown.above === undefined ? 'As designed' : px(shown.above)} onLess={() => setLook({ above: nextSpace(shown.above, -1) })} onMore={() => setLook({ above: nextSpace(shown.above, 1) })} />
        </Row>
        <Row label="Space below" from={from('below')} onReset={() => reset('below')}>
          <Step label="Space below" text={shown.below === undefined ? 'As designed' : px(shown.below)} onLess={() => setLook({ below: nextSpace(shown.below, -1) })} onMore={() => setLook({ below: nextSpace(shown.below, 1) })} />
        </Row>
        <p className="el-note">Space above and below moves what follows; use Position to move only this.</p>
      </Group>

      <button type="button" className="el-reset" disabled={!changed} onClick={() => setLook(Object.fromEntries(Object.keys(own).map((k) => [k, undefined])))}>Reset all {SCREEN_LABEL[screen]} changes</button>
      {mine && <FloatingToolbar look={look} canType={!!selected?.field} />}
    </div>
  )

}

// The section's single elements, as a list: another way to select one, also by keyboard.
function Parts({ blockId }: { blockId?: string }) {
  const { select } = useContext(Selection)
  const item = usePuck((s) => s.selectedItem)
  const dispatch = usePuck((s) => s.dispatch)
  const getSelectorForId = usePuck((s) => s.getSelectorForId)
  const design = ((item?.props as { design?: { background?: Colour } })?.design ?? {}) as { background?: Colour }
  const setBackground = (background: Colour | undefined) => {
    const at = item && getSelectorForId(item.props.id as string)
    if (!item || !at) return
    const next = { ...design, background }
    if (!background) delete next.background
    dispatch({ type: 'replace', destinationIndex: at.index, destinationZone: at.zone, data: { ...item, props: { ...item.props, design: next } } as never })
  }
  const [parts, setParts] = useState<{ key: string; field?: string }[]>([])
  useEffect(() => {
    const doc = canvas()
    if (!doc || !blockId) return setParts([])
    const seen = new Set<string>()
    setParts([...doc.querySelectorAll<HTMLElement>(`[data-puck-component="${blockId}"] [data-el]`)].flatMap((el) => {
      if (seen.has(el.dataset.el!)) return []
      seen.add(el.dataset.el!)
      return [{ key: el.dataset.el!, field: el.dataset.edit }]
    }))
  }, [blockId])
  return (
    <div className="el-panel">
      <p className="el-note">Click anything on the page to change it{parts.length ? ', or choose a part here' : ''}. Double-click words on the page to edit them. Drag the section's label bar to move the whole section.</p>
      <Group title="Section background">
        <Row label="Background" from={design.background ? 'here' : 'design'} onReset={() => setBackground(undefined)}>
          <Swatches value={design.background} onChange={setBackground} />
        </Row>
      </Group>
      {parts.length > 0 && (
        <Group title="Parts of this section">
          <ul className="el-parts">
            {parts.map((part) => <li key={part.key}><button type="button" onClick={() => select({ key: part.key, blockId: blockId!, field: part.field })}>{nameOf(part.key)}</button></li>)}
          </ul>
        </Group>
      )}
    </div>
  )
}

const nextSpace = (now: number | undefined, dir: 1 | -1) => {
  const i = now === undefined ? (dir > 0 ? SPACING.indexOf(1) - 1 : SPACING.indexOf(1) + 1) : SPACING.findIndex((s) => s >= now)
  return SPACING[Math.max(0, Math.min(SPACING.length - 1, i + dir))]
}

// ---- Small controls

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className="el-group" aria-label={title}><h3>{title}</h3>{children}</section>
}

function Row({ label, from, onReset, children }: { label: string; from: string; onReset: () => void; children: ReactNode }) {
  return (
    <div className="el-row">
      <div className="el-row-head">
        <span>{label}</span>
        {from === 'larger' && <small>follows a larger screen</small>}
        {from === 'here' && <button type="button" className="el-undo" aria-label={`${label}: back to as designed`} title="Back to as designed" onClick={onReset}>Reset</button>}
      </div>
      <div className="el-row-control">{children}</div>
    </div>
  )
}

function Step({ label, text, onLess, onMore }: { label: string; text: string; onLess: () => void; onMore: () => void }) {
  return (
    <div className="el-step">
      <button type="button" aria-label={`${label}: less`} onClick={onLess}>−</button>
      <output aria-live="polite">{text}</output>
      <button type="button" aria-label={`${label}: more`} onClick={onMore}>+</button>
    </div>
  )
}

function Segments<T extends string | number>({ label, value, options, onChange, small }: { label: string; value: T | undefined; options: [T, string, string?][]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div className={small ? 'el-segments el-segments-small' : 'el-segments'} role="group" aria-label={label}>
      {options.map(([v, text, name]) => <button key={String(v)} type="button" aria-pressed={v === value} aria-label={name} title={name} onClick={() => onChange(v)}>{text}</button>)}
    </div>
  )
}

function Swatches({ value, onChange }: { value: Colour | undefined; onChange: (c: Colour) => void }) {
  return (
    <div className="el-swatches" role="group" aria-label="Colour">
      {COLOURS.map((c) => <button key={c} type="button" aria-pressed={c === value} aria-label={c} title={c} style={{ background: SWATCH[c] }} onClick={() => onChange(c)} />)}
    </div>
  )
}

function FocusGrid({ x, y, onChange }: { x: number; y: number; onChange: (x: number, y: number) => void }) {
  const steps = [0, 50, 100]
  const name = (v: number, a: string, b: string) => (v === 0 ? a : v === 100 ? b : 'centre')
  return (
    <div className="el-focus" role="group" aria-label="Crop focus">
      {steps.map((fy) => steps.map((fx) => (
        <button key={`${fx}-${fy}`} type="button" aria-pressed={fx === x && fy === y} aria-label={`Focus ${name(fy, 'top', 'bottom')} ${name(fx, 'left', 'right')}`} onClick={() => onChange(fx, fy)} />
      )))}
    </div>
  )
}

// ---- The toolbar above the selected element: the most used settings, one click away.

function FloatingToolbar({ look, canType }: { look: ReturnType<typeof useLook>; canType: boolean }) {
  const { key, shown, setLook, from } = look
  const ref = useRef<HTMLDivElement>(null)
  const [colours, setColours] = useState(false)
  useEffect(() => {
    let raf = 0
    const place = () => {
      const bar = ref.current
      const el = selectedEl()
      const frame = document.getElementById('preview-frame')
      if (bar && el && frame && !el.hasAttribute('data-el-editing')) {
        const f = frame.getBoundingClientRect()
        const scale = f.width / (el.ownerDocument.documentElement.clientWidth || 1)
        const r = el.getBoundingClientRect()
        const top = f.top + r.top * scale - bar.offsetHeight - 30
        const left = Math.max(8, Math.min(Math.max(f.left + r.left * scale, f.left + 8), Math.min(f.right, innerWidth) - bar.offsetWidth - 8))
        const below = f.top + r.bottom * scale + 12
        const visible = r.bottom * scale > 0 && r.top * scale < f.height
        Object.assign(bar.style, { top: `${top < f.top + 4 ? below : top}px`, left: `${left}px`, visibility: visible ? 'visible' : 'hidden' })
      } else if (bar) bar.style.visibility = 'hidden'
      raf = requestAnimationFrame(place)
    }
    place()
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => setColours(false), [key])
  if (!key) return null
  const isImage = IMAGES.test(key)
  const el = selectedEl()
  const width = shown.width ?? (el ? widthNow(el) : 100)
  const type = () => {
    const el = selectedEl()
    el?.ownerDocument.defaultView?.focus()
    el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: el.getBoundingClientRect().left + 2, clientY: el.getBoundingClientRect().top + 2 }))
  }
  return createPortal(
    <div ref={ref} className="el-toolbar" role="toolbar" aria-label={`${nameOf(key)} quick settings`}>
      {canType && <button type="button" onClick={type}>Edit words</button>}
      {isImage ? (
        <>
          <button type="button" aria-label="Narrower" title="Narrower" onClick={() => setLook({ width: Math.max(20, width - 5) })}>−</button>
          <span className="el-toolbar-value">Width {width}%</span>
          <button type="button" aria-label="Wider" title="Wider" onClick={() => setLook({ width: Math.min(100, width + 5) })}>+</button>
        </>
      ) : (
        <>
          <button type="button" aria-label="Smaller text" title="Smaller text" onClick={() => setLook({ size: SIZES[Math.max(0, currentSize(shown) - 1)] })}>A−</button>
          <button type="button" aria-label="Larger text" title="Larger text" onClick={() => setLook({ size: SIZES[Math.min(SIZES.length - 1, currentSize(shown) + 1)] })}>A+</button>
          <button type="button" aria-pressed={(shown.weight ?? 0) >= 600} aria-label="Bold" title="Bold" className="el-bold" onClick={() => setLook({ weight: (shown.weight ?? 0) >= 600 ? 400 : 700 })}>B</button>
          <span className="el-toolbar-colours">
            <button type="button" aria-expanded={colours} aria-label="Colour" title="Colour" onClick={() => setColours(!colours)}><span className="el-dot" style={{ background: shown.colour ? SWATCH[shown.colour] : 'currentColor' }} /></button>
            {colours && <span className="el-toolbar-pop"><Swatches value={shown.colour} onChange={(colour) => { setLook({ colour }); setColours(false) }} /></span>}
          </span>
          <Segments label="Alignment" value={shown.align} options={[['left', 'L', 'Align left'], ['center', 'C', 'Align centre'], ['right', 'R', 'Align right']]} onChange={(align) => setLook({ align: align as ElementLook['align'] })} small />
        </>
      )}
      <button type="button" disabled={!Object.keys(look.own).length} onClick={() => setLook(Object.fromEntries(Object.keys(look.own).map((k) => [k, undefined])))} title="Undo all changes to this element at this screen size">Reset</button>
      {from('x') === 'here' || from('y') === 'here' ? <span className="el-toolbar-value">Moved</span> : null}
    </div>,
    document.body,
  )
}
