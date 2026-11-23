import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createUsePuck } from '@puckeditor/core'
import { COLOURS, contrast, type Colour } from '#/layout/design'
import { COVER_NAMES, COVER_SIZES, TEXT_SIZES, lookAt, type ElementLook, type ElementStyle, type Elements, type Screen, type TextSize } from '#/layout/elements'
import type { Project } from '#/lib/site'
import { IMAGES, Selection, coverListeners, widthNow, announceListeners, moveListeners, nameOf, round, setSnapOn, snapOn, useWords, widthListeners } from './elements'
import { BoxCentreIcon, BoxEndIcon, BoxStartIcon, EyeOffIcon, AlignCentreIcon, AlignLeftIcon, AlignRightIcon, BoldIcon, CopyIcon, DownIcon, LayersIcon, PenIcon, PlusIcon, ResetIcon, SlidersIcon, TrashIcon, UpIcon } from './icons'

// The editing controls. The contextual bar under the top bar holds what you use most for the
// selected text, image or section; the side panel ("More settings") holds everything, grouped.
// Both read and change the same settings, for the screen size chosen in the top bar.

const usePuck = createUsePuck()

const SCREEN_LABEL: Record<Screen, string> = { desktop: 'Desktop', tablet: 'Tablet', phone: 'Phone' }
export const screenFor = (width: number): Screen => (width >= 1280 ? 'desktop' : width >= 900 ? 'tablet' : 'phone')
const SIZES = Object.keys(TEXT_SIZES) as TextSize[]
const SPACING = [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]
const SWATCH: Record<Colour, string> = { Olive: 'var(--olive)', Sage: 'var(--sage)', 'Light sage': 'var(--lsage)', 'Off-white': 'var(--off)', Terracotta: 'var(--terra)' }
const WEIGHTS: [number, string][] = [[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold']]
const ALIGN: [NonNullable<ElementLook['align']>, string, () => ReactNode][] = [['left', 'Left', AlignLeftIcon], ['center', 'Centre', AlignCentreIcon], ['right', 'Right', AlignRightIcon]]
const LOOKS: (keyof ElementLook)[] = ['place', 'hidden', 'cover', 'x', 'y', 'size', 'weight', 'colour', 'align', 'width', 'focusX', 'focusY', 'above', 'below']
const BOX: [NonNullable<ElementLook['place']>, string, () => ReactNode][] = [['start', 'Left', BoxStartIcon], ['center', 'Centre', BoxCentreIcon], ['end', 'Right', BoxEndIcon]]
// A box can only be placed when it is a block narrower than its area could make it (not words inside a sentence).
const placeable = () => { const el = selectedEl(); return !!el && !['inline', 'contents'].includes(getComputedStyle(el).display) }
const px = (rem: number) => `${Math.round(rem * 16)} px`

export const canvas = () => (document.getElementById('preview-frame') as HTMLIFrameElement | null)?.contentDocument ?? null
const selectedEl = () => canvas()?.querySelector<HTMLElement>('[data-el-selected]') ?? null

// The selected element's settings at the screen size being edited, and a way to change them.
function useLook() {
  const { selected } = useContext(Selection)
  const item = usePuck((s) => s.selectedItem)
  const ui = usePuck((s) => s.appState.ui)
  const dispatch = usePuck((s) => s.dispatch)
  const getSelectorForId = usePuck((s) => s.getSelectorForId)
  const screen = screenFor(Number(ui.viewports.current.width) || 1440)
  const key = selected && item && selected.blockId === item.props.id ? selected.key : null
  const value = (item?.props as { elements?: Elements } | undefined)?.elements
  const style: ElementStyle = (key && value?.[key]) || {}
  const own = style[screen] ?? {}
  const shown = lookAt(style, screen)
  const setLook = (patch: Partial<ElementLook>) => {
    const at = item && getSelectorForId(item.props.id as string)
    if (!key || !item || !at) return
    const next = { ...own, ...patch }
    for (const k of Object.keys(next) as (keyof ElementLook)[]) if (next[k] === undefined) delete next[k]
    const nextStyle = { ...style, [screen]: next }
    if (!Object.keys(next).length) delete nextStyle[screen]
    const all = { ...(value ?? {}), [key]: nextStyle }
    if (!Object.keys(nextStyle).length) delete all[key]
    dispatch({ type: 'replace', destinationIndex: at.index, destinationZone: at.zone, data: { ...item, props: { ...item.props, elements: all } } as never })
  }
  // Set at this size, following a larger size, or as designed.
  const from = (...k: (keyof ElementLook)[]) => (k.some((x) => own[x] !== undefined) ? 'here' : k.some((x) => shown[x] !== undefined) ? 'larger' : 'design')
  const resetAll = () => setLook(Object.fromEntries(Object.keys(own).map((k) => [k, undefined])))
  const background = ((item?.props as { design?: { background?: Colour } })?.design?.background ?? 'Off-white') as Colour
  return { key, item, selected, screen, own, shown, setLook, from, resetAll, background }
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
// A project's opening cover is sized in steps rather than by width.
const isCover = (type: string | undefined, key: string) => type === 'Opening' && key === 'image'
const COVER_OPTIONS = COVER_SIZES.map((c) => [c, COVER_NAMES[c]] as [string, string])
const sizeName = (look: ElementLook) => TEXT_SIZES[SIZES[currentSize(look)]][0]

const LABELS: Record<string, string> = { Opening: 'Opening', Facts: 'Facts', Overview: 'Overview', Research: 'Research & thinking', Work: 'The work', Outcomes: 'Outcomes', AlsoIn: 'Also in this category', PrevNext: 'Previous and next', CategoryNav: 'Category list', SectionNav: 'Section bar', Gap: 'Gap', Text: 'Text', Image: 'Image', Grid: 'Grid', Cell: 'Grid column', Spacer: 'Spacer' }
export const sectionName = (type: string) => LABELS[type] ?? type

// ---- The contextual bar: under the top bar, it changes with what is selected.

export function ContextBar() {
  const { key, item, selected, screen, shown, setLook, from, resetAll } = useLook()
  const { select } = useContext(Selection)
  const ui = usePuck((s) => s.appState.ui)
  const dispatch = usePuck((s) => s.dispatch)
  const getSelectorForId = usePuck((s) => s.getSelectorForId)
  const content = usePuck((s) => s.appState.data.content)
  const latest = useRef(setLook)
  latest.current = setLook
  const [message, setMessage] = useState('')
  useEffect(() => {
    const onMove = (x: number, y: number) => latest.current({ x, y })
    const onWidth = (width: number) => latest.current({ width })
    const onCover = (steps: number) => latestCover.current(steps)
    moveListeners.add(onMove)
    widthListeners.add(onWidth)
    coverListeners.add(onCover)
    announceListeners.add(setMessage)
    return () => { moveListeners.delete(onMove); widthListeners.delete(onWidth); coverListeners.delete(onCover); announceListeners.delete(setMessage) }
  }, [])
  const latestCover = useRef((_steps: number) => {})
  latestCover.current = (steps: number) => {
    const now = COVER_SIZES.indexOf(shown.cover ?? 'standard')
    const next = COVER_SIZES[Math.max(0, Math.min(COVER_SIZES.length - 1, now + steps))]
    setLook({ cover: next })
    setMessage(`Cover size: ${COVER_NAMES[next]}.`)
  }
  useEffect(() => setMessage(''), [key, item?.props.id])
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(''), 5000); return () => clearTimeout(t) }, [message])

  // On phones the editor uses a panel at the bottom of the screen, so settings open there.
  const phone = () => window.innerWidth < 638
  const toggleSettings = () => {
    if (phone()) {
      // The phone layout's own Settings tab opens and closes its bottom panel.
      const tab = [...document.querySelectorAll<HTMLElement>("[class*='NavItem-link']")].find((b) => b.textContent?.trim() === 'Settings')
      tab?.click()
    } else dispatch({ type: 'setUi', ui: { rightSideBarVisible: !ui.rightSideBarVisible } })
  }
  const showLeft = (plugin: 'blocks' | 'outline') => dispatch({ type: 'setUi', ui: { leftSideBarVisible: true, plugin: { current: plugin } } })
  const more = (
    <button type="button" className="ctx-btn" aria-pressed={phone() ? ui.plugin?.current === 'fields' : ui.rightSideBarVisible} onClick={toggleSettings}>
      <SlidersIcon /><span className="ctx-long">{ui.rightSideBarVisible ? 'Hide settings' : 'More settings'}</span><span className="ctx-short">Settings</span>
    </button>
  )
  // Moves and other news appear here briefly; otherwise, off Desktop, a reminder of which size you are changing.
  const where = (
    <>
      {message && <span className="ctx-live">{message}</span>}
      {screen !== 'desktop' && <span className="ctx-where"><span className="ctx-long">Changes apply to </span>{SCREEN_LABEL[screen]} only</span>}
    </>
  )
  const live = <span className="sr-only" role="status" aria-live="polite">{message}</span>

  // Nothing selected: what to do first, and the two ways to change the page's structure.
  if (!item) {
    return (
      <div className="ctx" role="toolbar" aria-label="Editing tools">
        <p className="ctx-hint"><b>Click</b> anything on the page to change it. <b>Double-click</b> words to type.</p>
        <span className="ctx-gap" />
        <button type="button" className="ctx-btn" onClick={() => showLeft('blocks')}><PlusIcon /><span>Add a section</span></button>
        <button type="button" className="ctx-btn" onClick={() => showLeft('outline')}><LayersIcon /><span>Page navigator</span></button>
        {live}
      </div>
    )
  }

  // A section is selected: its background, and moving, duplicating or removing it.
  if (!key) {
    const at = getSelectorForId(item.props.id as string)
    const design = ((item.props as { design?: { background?: Colour } }).design ?? {}) as { background?: Colour }
    const setBackground = (background: Colour | undefined) => {
      if (!at) return
      const next = { ...design, background }
      if (!background) delete next.background
      dispatch({ type: 'replace', destinationIndex: at.index, destinationZone: at.zone, data: { ...item, props: { ...item.props, design: next } } as never })
    }
    const last = at ? at.index >= (at.zone.startsWith('root') ? content.length - 1 : Infinity) : true
    return (
      <div className="ctx" role="toolbar" aria-label="Section tools">
        <span className="ctx-name">{sectionName(item.type)}</span>
        <span className="ctx-group" role="group" aria-label="Background">
          <span className="ctx-label">Background</span>
          <Swatches value={design.background} onChange={setBackground} small />
          {design.background && <button type="button" className="ctx-icon" title="Background as designed" aria-label="Background as designed" onClick={() => setBackground(undefined)}><ResetIcon /></button>}
        </span>
        <span className="ctx-group">
          <button type="button" className="ctx-btn" disabled={!at || at.index === 0} onClick={() => at && dispatch({ type: 'reorder', sourceIndex: at.index, destinationIndex: at.index - 1, destinationZone: at.zone })}><UpIcon /><span>Move up</span></button>
          <button type="button" className="ctx-btn" disabled={!at || last} onClick={() => at && dispatch({ type: 'reorder', sourceIndex: at.index, destinationIndex: at.index + 1, destinationZone: at.zone })}><DownIcon /><span>Move down</span></button>
          <button type="button" className="ctx-btn" disabled={!at} onClick={() => at && dispatch({ type: 'duplicate', sourceIndex: at.index, sourceZone: at.zone })}><CopyIcon /><span>Duplicate</span></button>
          <button type="button" className="ctx-btn ctx-danger" disabled={!at} onClick={() => at && dispatch({ type: 'remove', index: at.index, zone: at.zone })}><TrashIcon /><span>Remove</span></button>
        </span>
        <span className="ctx-gap" />
        {more}
        {live}
      </div>
    )
  }

  // A shared name (a category): only its words change, and the change reaches every page.
  if (key.startsWith('cat-')) {
    const startTypingShared = () => {
      const target = selectedEl()
      if (!target) return
      const r = target.getBoundingClientRect()
      target.ownerDocument.defaultView?.focus()
      target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + 2, clientY: r.top + 2 }))
    }
    return (
      <div className="ctx" role="toolbar" aria-label={`${nameOf(key)} tools`}>
        <span className="ctx-name">{nameOf(key)}</span>
        <button type="button" className="ctx-btn" onClick={startTypingShared}><PenIcon /><span>Edit name</span></button>
        <span className="ctx-shared">Shared: renaming it changes every page, the Projects page and the filters when you publish</span>
        <span className="ctx-gap" />
        {message ? <span className="ctx-live">{message}</span> : null}
        <button type="button" className="ctx-icon" aria-label="Done, deselect (Esc)" title="Done (Esc)" onClick={() => select(null)}>✕</button>
        {live}
      </div>
    )
  }

  // An element is selected: the settings used most, one click away.
  const isImage = IMAGES.test(key)
  const el = selectedEl()
  const width = shown.width ?? (el ? widthNow(el) : 100)
  const startTyping = () => {
    const target = selectedEl()
    if (!target) return
    const r = target.getBoundingClientRect()
    target.ownerDocument.defaultView?.focus()
    target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + 2, clientY: r.top + 2 }))
  }
  // Hiding applies to this screen size and the smaller ones, unless shown again there.
  const toggleHidden = () => setLook({ hidden: shown.hidden ? (screen === 'desktop' ? undefined : false) : true })
  return (
    <div className="ctx" role="toolbar" aria-label={`${nameOf(key)} tools`}>
      <span className="ctx-name">{nameOf(key)}</span>
      {selected?.field && <button type="button" className="ctx-btn" aria-label="Edit words" onClick={startTyping}><PenIcon /><span className="ctx-edit-word">Edit words</span></button>}
      {isCover(item.type, key) ? (
        <span className="ctx-group" role="group" aria-label="Cover size">
          <span className="ctx-label">Cover size</span>
          <span className="ctx-segment ctx-words">
            {COVER_OPTIONS.map(([v, name]) => <button key={v} type="button" aria-pressed={(shown.cover ?? 'standard') === v} onClick={() => setLook({ cover: v as ElementLook['cover'] })}>{name}</button>)}
          </span>
        </span>
      ) : isImage ? (
        <span className="ctx-group" role="group" aria-label="Width">
          <span className="ctx-label">Width</span>
          <input type="range" min={20} max={100} step={5} value={width} aria-label="Width" aria-valuetext={`${width}%`} onChange={(e) => setLook({ width: Number(e.target.value) })} />
          <output className="ctx-value">{width}%</output>
        </span>
      ) : (
        <>
          <span className="ctx-group" role="group" aria-label="Text size">
            <span className="ctx-label ctx-label-plain">Size</span>
            <span className="ctx-stepper">
              <button type="button" aria-label="Smaller text" title="Smaller" onClick={() => setLook({ size: SIZES[Math.max(0, currentSize(shown) - 1)] })}>−</button>
              <output>{sizeName(shown)}</output>
              <button type="button" aria-label="Larger text" title="Larger" onClick={() => setLook({ size: SIZES[Math.min(SIZES.length - 1, currentSize(shown) + 1)] })}>+</button>
            </span>
          </span>
          <button type="button" className="ctx-icon" aria-pressed={(shown.weight ?? 0) >= 600} aria-label="Bold" title="Bold" onClick={() => setLook({ weight: (shown.weight ?? 0) >= 600 ? 400 : 700 })}><BoldIcon /></button>
          <span className="ctx-group" role="group" aria-label="Colour">
            <span className="ctx-label ctx-label-plain">Colour</span>
            <Swatches value={shown.colour} onChange={(colour) => setLook({ colour })} small />
          </span>
          <span className="ctx-group" role="group" aria-label="Text alignment">
            <span className="ctx-label">Text</span>
            <span className="ctx-segment">
              {ALIGN.map(([v, name, AlignIcon]) => <button key={v} type="button" aria-pressed={shown.align === v} aria-label={`Text: align ${name.toLowerCase()}`} title={`Align the words ${name.toLowerCase()}`} onClick={() => setLook({ align: v })}><AlignIcon /></button>)}
            </span>
          </span>
          {placeable() && (
            <span className="ctx-group ctx-box" role="group" aria-label="Box position">
              <span className="ctx-label">Box</span>
              <span className="ctx-segment">
                {BOX.map(([v, name, BoxIcon]) => <button key={v} type="button" aria-pressed={shown.place === v} aria-label={`Box: ${name.toLowerCase()} of its area`} title={`Place the whole box at the ${name.toLowerCase()} of its area`} onClick={() => setLook({ place: shown.place === v ? undefined : v })}><BoxIcon /></button>)}
              </span>
            </span>
          )}
        </>
      )}
      <button type="button" className="ctx-btn ctx-hide" aria-pressed={!!shown.hidden} aria-label={shown.hidden ? `Hidden on ${SCREEN_LABEL[screen]}: show it` : `Hide on ${SCREEN_LABEL[screen]}`} onClick={toggleHidden} title={shown.hidden ? `Show it again on ${SCREEN_LABEL[screen]}` : `Leave it out on ${SCREEN_LABEL[screen]}${screen === 'phone' ? '' : ' (and smaller screens)'}`}><EyeOffIcon /><span className="ctx-reset-word">{shown.hidden ? "Hidden here" : "Hide here"}</span></button>
      <button type="button" className="ctx-btn ctx-reset" aria-label="Reset changes" disabled={from(...LOOKS) !== 'here'} onClick={resetAll} title={`Reset: undo every change to this at ${SCREEN_LABEL[screen]} size`}><ResetIcon /><span className="ctx-reset-word">Reset</span></button>
      <span className="ctx-gap" />
      {where}
      {more}
      <button type="button" className="ctx-icon" aria-label="Done, deselect (Esc)" title="Done (Esc)" onClick={() => select(null)}>✕</button>
      {live}
    </div>
  )
}

// ---- The side panel ("More settings"): everything for the selection, grouped and labelled.

export function ElementPanel({ p }: { value?: Elements; onChange?: (v: Elements) => void; p: Project }) {
  const { key, item, selected, screen, own, shown, setLook, from, resetAll, background } = useLook()
  const words = useWords(p)
  const [snapping, setSnapping] = useState(snapOn)

  if (!key) return <Parts blockId={item?.props.id as string | undefined} />

  if (key.startsWith('cat-') && selected?.field) {
    return (
      <div className="el-panel">
        <div className="el-head"><p className="el-name">{nameOf(key)}</p><p className="el-note">Shared by every page, the Projects page and the filters. Its look follows the site's design.</p></div>
        <Group title="Name">
          <textarea className="el-words" rows={1} aria-label="Category name" value={words.read(selected.field, selected.blockId)} onChange={(e) => words.write(selected.field!, e.target.value.replace(/\n/g, ' '), selected.blockId)} />
        </Group>
      </div>
    )
  }

  const isImage = IMAGES.test(key)
  const el = selectedEl()
  const width = shown.width ?? (el ? widthNow(el) : 100)
  const ratio = shown.colour && !isImage ? contrast(shown.colour, background) : null
  const reset = (...keys: (keyof ElementLook)[]) => setLook(Object.fromEntries(keys.map((k) => [k, undefined])))

  return (
    <div className="el-panel">
      <div className="el-head">
        <p className="el-name">{nameOf(key)}</p>
        <p className="el-note">Changes apply to <b>{SCREEN_LABEL[screen]}</b>{screen === 'desktop' ? '; Tablet and Phone follow.' : ' only.'}</p>
      </div>

      {selected?.field && (
        <Group title="Words">
          <textarea className="el-words" rows={2} aria-label="Words" value={words.read(selected.field, selected.blockId)} onChange={(e) => words.write(selected.field!, e.target.value, selected.blockId)} />
        </Group>
      )}

      {isCover(item?.type, key) ? (
        <Group title="Cover">
          <Row label="Cover size" hint="Larger covers take more of the page; the words beside them make room." from={from('cover')} onReset={() => reset('cover')}>
            <Segments label="Cover size" value={shown.cover ?? 'standard'} options={COVER_OPTIONS} onChange={(cover) => setLook({ cover: cover as ElementLook['cover'] })} />
          </Row>
        </Group>
      ) : isImage ? (
        <Group title="Image">
          <Row label="Width" from={from('width')} onReset={() => reset('width')}>
            <input type="range" min={20} max={100} step={5} value={width} aria-label="Width" aria-valuetext={`${width}%`} onChange={(e) => setLook({ width: Number(e.target.value) })} />
            <output>{width}%</output>
          </Row>
          <Row label="Crop focus" hint="The part of the photo kept in view when it is cropped." from={from('focusX', 'focusY')} onReset={() => reset('focusX', 'focusY')}>
            <FocusGrid x={shown.focusX ?? 50} y={shown.focusY ?? 50} onChange={(focusX, focusY) => setLook({ focusX, focusY })} />
          </Row>
        </Group>
      ) : (
        <Group title="Text">
          <Row label="Size" from={from('size')} onReset={() => reset('size')}>
            <Step label="Size" text={sizeName(shown)} onLess={() => setLook({ size: SIZES[Math.max(0, currentSize(shown) - 1)] })} onMore={() => setLook({ size: SIZES[Math.min(SIZES.length - 1, currentSize(shown) + 1)] })} />
          </Row>
          <Row label="Weight" from={from('weight')} onReset={() => reset('weight')}>
            <Segments label="Weight" value={shown.weight} options={WEIGHTS} onChange={(weight) => setLook({ weight: weight as ElementLook['weight'] })} />
          </Row>
          <Row label="Colour" from={from('colour')} onReset={() => reset('colour')}>
            <Swatches value={shown.colour} onChange={(colour) => setLook({ colour })} />
          </Row>
          {ratio !== null && ratio < 4.5 && <p className="el-warning" role="note">{shown.colour} on {background} is hard to read. Choose another colour.</p>}
          <Row label="Text alignment" hint="How the words line up inside the box." from={from('align')} onReset={() => reset('align')}>
            <Segments label="Text alignment" value={shown.align} options={ALIGN.map(([v, name]) => [v, name])} onChange={(align) => setLook({ align: align as ElementLook['align'] })} />
          </Row>
          {placeable() && (
            <Row label="Box position" hint="Where the whole box sits in its area. The words keep their own alignment." from={from('place')} onReset={() => reset('place')}>
              <Segments label="Box position" value={shown.place} options={BOX.map(([v, name]) => [v, name])} onChange={(place) => setLook({ place: place as ElementLook['place'] })} />
            </Row>
          )}
        </Group>
      )}

      <Group title="Visibility">
        <label className="el-switch"><input type="checkbox" checked={!!shown.hidden} onChange={(e) => setLook({ hidden: e.target.checked ? true : screen === 'desktop' ? undefined : false })} /> Hide on {SCREEN_LABEL[screen]}{screen !== 'phone' && ' (and smaller screens unless shown there)'}</label>
      </Group>

      <Group title="Position">
        <Row label="Across" from={from('x')} onReset={() => reset('x')}>
          <Step label="Across" text={px(shown.x ?? 0)} onLess={() => setLook({ x: round((shown.x ?? 0) - 0.25) })} onMore={() => setLook({ x: round((shown.x ?? 0) + 0.25) })} />
        </Row>
        <Row label="Down" from={from('y')} onReset={() => reset('y')}>
          <Step label="Down" text={px(shown.y ?? 0)} onLess={() => setLook({ y: round((shown.y ?? 0) - 0.25) })} onMore={() => setLook({ y: round((shown.y ?? 0) + 0.25) })} />
        </Row>
        <label className="el-switch"><input type="checkbox" checked={snapping} onChange={(e) => { setSnapOn(e.target.checked); setSnapping(e.target.checked) }} /> Snap to alignment guides</label>
        <p className="el-note">Or drag it on the page. Arrow keys move it too; hold Option to move without snapping.</p>
      </Group>

      <Group title="Spacing">
        <Row label="Space above" hint="This also moves what comes after it." from={from('above')} onReset={() => reset('above')}>
          <Step label="Space above" text={shown.above === undefined ? 'As designed' : px(shown.above)} onLess={() => setLook({ above: nextSpace(shown.above, -1) })} onMore={() => setLook({ above: nextSpace(shown.above, 1) })} />
        </Row>
        <Row label="Space below" from={from('below')} onReset={() => reset('below')}>
          <Step label="Space below" text={shown.below === undefined ? 'As designed' : px(shown.below)} onLess={() => setLook({ below: nextSpace(shown.below, -1) })} onMore={() => setLook({ below: nextSpace(shown.below, 1) })} />
        </Row>
      </Group>

      <button type="button" className="el-reset" disabled={!Object.keys(own).length} onClick={resetAll}><ResetIcon /> Reset all {SCREEN_LABEL[screen]} changes</button>
    </div>
  )
}

// A section with no element selected: its parts, another way to select one (also by keyboard).
function Parts({ blockId }: { blockId?: string }) {
  const { select } = useContext(Selection)
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
  if (!parts.length) return null
  return (
    <div className="el-panel">
      <Group title="Parts of this section">
        <ul className="el-parts">
          {parts.map((part) => <li key={part.key}><button type="button" onClick={() => select({ key: part.key, blockId: blockId!, field: part.field })}>{nameOf(part.key)}</button></li>)}
        </ul>
      </Group>
    </div>
  )
}

const nextSpace = (now: number | undefined, dir: 1 | -1) => {
  const i = now === undefined ? (dir > 0 ? SPACING.indexOf(1) - 1 : SPACING.indexOf(1) + 1) : SPACING.findIndex((s) => s >= now)
  return SPACING[Math.max(0, Math.min(SPACING.length - 1, i + dir))]
}

// ---- Small controls, shared by the bar and the panel

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className="el-group" aria-label={title}><h3>{title}</h3>{children}</section>
}

function Row({ label, hint, from, onReset, children }: { label: string; hint?: string; from: string; onReset: () => void; children: ReactNode }) {
  return (
    <div className="el-row">
      <div className="el-row-head">
        <span>{label}</span>
        {from === 'larger' && <small className="el-from">from a larger screen</small>}
        {from === 'here' && <button type="button" className="el-undo" aria-label={`${label}: back to as designed`} title="Back to as designed" onClick={onReset}><ResetIcon /></button>}
      </div>
      {hint && <p className="el-note">{hint}</p>}
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

function Segments<T extends string | number>({ label, value, options, onChange }: { label: string; value: T | undefined; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="el-segments" role="group" aria-label={label}>
      {options.map(([v, text]) => <button key={String(v)} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{text}</button>)}
    </div>
  )
}

function Swatches({ value, onChange, small }: { value: Colour | undefined; onChange: (c: Colour) => void; small?: boolean }) {
  return (
    <div className={small ? 'el-swatches el-swatches-small' : 'el-swatches'} role="group" aria-label="Colour">
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
