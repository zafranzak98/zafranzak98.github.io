import { kindName } from './sections'
import { openPhotoPicker } from './photos'
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { createUsePuck } from '@puckeditor/core'
import { COLOURS, contrast, type Colour } from '#/layout/design'
import { COVER_NAMES, COVER_SIZES, TEXT_SIZES, lookAt, type ElementLook, type ElementStyle, type Elements, type Screen, type TextSize } from '#/layout/elements'
import { photoSize, type Project } from '#/lib/site'
import { ratioOptions } from '#/layout/free-blocks'
import { IMAGES, Selection, type Picked, angleOf, groupMoveListeners, coverListeners, rotateListeners, stackListeners, widthNow, announceListeners, moveListeners, nameOf, round, setSnapOn, snapOn, useWords, widthListeners } from './elements'
import { BoxCentreIcon, BoxEndIcon, BoxStartIcon, EyeOffIcon, AlignCentreIcon, AlignLeftIcon, AlignRightIcon, BoldIcon, CopyIcon, DownIcon, LayersIcon, PenIcon, ResetIcon, RotateIcon, SelectMoreIcon, ImageIcon, SlidersIcon, TrashIcon, UpIcon } from './icons'

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
const LOOKS: (keyof ElementLook)[] = ['place', 'hidden', 'cover', 'x', 'y', 'size', 'weight', 'colour', 'align', 'width', 'focusX', 'focusY', 'rotate', 'above', 'below']
const BOX: [NonNullable<ElementLook['place']>, string, () => ReactNode][] = [['start', 'Left', BoxStartIcon], ['center', 'Centre', BoxCentreIcon], ['end', 'Right', BoxEndIcon]]
// A box can only be placed when it is a block narrower than its area could make it (not words inside a sentence).
const placeable = () => { const el = selectedEl(); return !!el && !['inline', 'contents'].includes(getComputedStyle(el).display) }
const px = (rem: number) => `${Math.round(rem * 16)} px`

export const canvas = () => (document.getElementById('preview-frame') as HTMLIFrameElement | null)?.contentDocument ?? null
const selectedEl = () => canvas()?.querySelector<HTMLElement>('[data-el-selected]') ?? null
// The element for a selection, found by its section and name (right after a new selection the page
// may not yet mark it as selected).
const elFor = (blockId?: string, key?: string | null) => {
  const found = blockId && key ? canvas()?.querySelector<HTMLElement>(`[data-puck-component="${blockId}"] [data-el="${key}"]`) : null
  return found ?? selectedEl()
}

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
  // Settings of the whole section (an Image section's shape and fit), the same on every screen size.
  const setProps = (patch: Record<string, unknown>) => {
    const at = item && getSelectorForId(item.props.id as string)
    if (!item || !at) return
    dispatch({ type: 'replace', destinationIndex: at.index, destinationZone: at.zone, data: { ...item, props: { ...item.props, ...patch } } as never })
  }
  // Set at this size, following a larger size, or as designed.
  const from = (...k: (keyof ElementLook)[]) => (k.some((x) => own[x] !== undefined) ? 'here' : k.some((x) => shown[x] !== undefined) ? 'larger' : 'design')
  const resetAll = () => setLook(Object.fromEntries(Object.keys(own).map((k) => [k, undefined])))
  const background = ((item?.props as { design?: { background?: Colour } })?.design?.background ?? 'Off-white') as Colour
  return { key, item, selected, screen, own, shown, setLook, setProps, from, resetAll, background }
}

// Several elements, in any sections, change together as one change: one step to undo.
type Item = { type: string; props: Record<string, unknown> & { id?: string; elements?: Elements } }
const isItem = (n: unknown): n is Item => !!n && typeof n === 'object' && 'type' in n && 'props' in n
function eachItem(node: unknown, fn: (item: Item) => Item): unknown {
  if (Array.isArray(node)) return node.map((n) => eachItem(n, fn))
  if (!isItem(node)) return node
  const item = fn(node)
  // Sections inside sections (grid columns) keep their contents in arrays on their props.
  const props = Object.fromEntries(Object.entries(item.props).map(([k, v]) => [k, Array.isArray(v) ? eachItem(v, fn) : v]))
  return { ...item, props }
}
type Data = { content: unknown[]; zones?: Record<string, unknown[]> }
const allItems = (data: Data) => {
  const found: Item[] = []
  eachItem([...data.content, ...Object.values(data.zones ?? {}).flat()], (it) => { found.push(it); return it })
  return found
}
// Merges a change into one element's settings at one screen size, dropping what becomes empty.
function merged(all: Elements | undefined, key: string, screen: Screen, patch: Partial<ElementLook>): Elements {
  const style: ElementStyle = all?.[key] ?? {}
  const next = { ...(style[screen] ?? {}), ...patch }
  for (const k of Object.keys(next) as (keyof ElementLook)[]) if (next[k] === undefined) delete next[k]
  const nextStyle = { ...style, [screen]: next }
  if (!Object.keys(next).length) delete nextStyle[screen]
  const out = { ...(all ?? {}), [key]: nextStyle }
  if (!Object.keys(nextStyle).length) delete out[key]
  return out
}

// The group's members, each with its settings at the screen size being edited.
function useGroup() {
  const { group } = useContext(Selection)
  const data = usePuck((s) => s.appState.data) as unknown as Data
  const ui = usePuck((s) => s.appState.ui)
  const dispatch = usePuck((s) => s.dispatch)
  const screen = screenFor(Number(ui.viewports.current.width) || 1440)
  const items = group.length > 1 ? allItems(data) : []
  const members = group.map((m) => {
    const style: ElementStyle = items.find((it) => it.props.id === m.blockId)?.props.elements?.[m.key] ?? {}
    return { ...m, own: style[screen] ?? {}, shown: lookAt(style, screen) }
  })
  // One change for every member: patch(member) gives that member's change, or nothing.
  const apply = (patch: (m: (typeof members)[number]) => Partial<ElementLook> | null) => {
    const changes = new Map<string, [string, Partial<ElementLook>][]>()
    for (const m of members) {
      const p = patch(m)
      if (p) changes.set(m.blockId, [...(changes.get(m.blockId) ?? []), [m.key, p]])
    }
    if (!changes.size) return
    const fn = (it: Item) => {
      const list = it.props.id ? changes.get(it.props.id) : undefined
      if (!list) return it
      const elements = list.reduce((all, [key, p]) => merged(all, key, screen, p), it.props.elements)
      return { ...it, props: { ...it.props, elements } }
    }
    // setData is left out of undo history unless asked, so the group change is recorded explicitly.
    dispatch({ type: 'setData', recordHistory: true, data: (prev: unknown) => {
      const d = prev as Data
      return { ...d, content: eachItem(d.content, fn), zones: Object.fromEntries(Object.entries(d.zones ?? {}).map(([z, v]) => [z, eachItem(v, fn)])) } as never
    } })
  }
  return { members, screen, apply }
}

// The text size an element shows now, as the nearest step on the site's type scale.
function currentSize(look: ElementLook, of: HTMLElement | null = selectedEl()): number {
  if (look.size) return SIZES.indexOf(look.size)
  const el = of
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

export const sectionName = kindName

// ---- The contextual bar: under the top bar, it changes with what is selected.

// "Select more": the touchscreen way to Shift-click. On, each tap adds or removes a part.
function SelectMore() {
  const { adding, setAdding } = useContext(Selection)
  return <button type="button" className="ctx-btn ctx-more-sel" aria-label="Select more" aria-pressed={adding} title="Tap more parts to change them together (or Shift-click)" onClick={() => setAdding(!adding)}><SelectMoreIcon /><span className="ctx-reset-word">Select more</span></button>
}

export function ContextBar() {
  const { key, item, selected, screen, shown, setLook, from, resetAll } = useLook()
  const { select } = useContext(Selection)
  const ui = usePuck((s) => s.appState.ui)
  const dispatch = usePuck((s) => s.dispatch)
  const getSelectorForId = usePuck((s) => s.getSelectorForId)
  const content = usePuck((s) => s.appState.data.content)
  const latest = useRef(setLook)
  latest.current = setLook
  const grouping = useGroup()
  const latestGroup = useRef(grouping)
  latestGroup.current = grouping
  const [message, setMessage] = useState('')
  const [stack, setStack] = useState<{ for: string; parts: Picked[] }>({ for: '', parts: [] })
  useEffect(() => {
    const onStack = (parts: Picked[], picked: Picked | null) => setStack({ for: picked ? `${picked.blockId}|${picked.key}` : '', parts })
    stackListeners.add(onStack)
    return () => { stackListeners.delete(onStack) }
  }, [])
  useEffect(() => {
    const onMove = (x: number, y: number) => latest.current({ x, y })
    const onWidth = (width: number) => latest.current({ width })
    const onRotate = (rotate: number) => latest.current({ rotate })
    const onCover = (steps: number) => latestCover.current(steps)
    const onGroupMove = (moves: { key: string; blockId: string; x: number; y: number }[]) =>
      latestGroup.current.apply((m) => { const to = moves.find((v) => v.key === m.key && v.blockId === m.blockId); return to ? { x: to.x, y: to.y } : null })
    groupMoveListeners.add(onGroupMove)
    moveListeners.add(onMove)
    widthListeners.add(onWidth)
    coverListeners.add(onCover)
    rotateListeners.add(onRotate)
    announceListeners.add(setMessage)
    return () => { groupMoveListeners.delete(onGroupMove); moveListeners.delete(onMove); widthListeners.delete(onWidth); coverListeners.delete(onCover); rotateListeners.delete(onRotate); announceListeners.delete(setMessage) }
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

  if (grouping.members.length > 1) return <GroupBar {...grouping} where={where} more={more} live={live} onDone={() => select(null)} announce={setMessage} />

  // Nothing selected: what to do first. Adding and rearranging sections is in the side rail.
  if (!item) {
    return (
      <div className="ctx ctx-empty">
        <p className="ctx-hint"><b>Click</b> anything on the page to change it. <b>Double-click</b> words to type.<span className="ctx-long"> To add or reorder sections, open <b>Sections</b> on the left.</span></p>
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
        {item.type === 'Image' && <button type="button" className="ctx-btn ctx-photo" onClick={() => openPhotoPicker(item.props.id as string)}><ImageIcon /><span>{(item.props as { image?: string }).image ? 'Replace photo' : 'Choose a photo'}</span></button>}
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
  const el = elFor(selected?.blockId, key)
  const width = shown.width ?? (el ? widthNow(el) : 100)
  const angle = shown.rotate ?? (el && isImage ? angleOf(el) : 0)
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
      {selected && stack.for === `${selected.blockId}|${key}` && stack.parts.length > 0 && <AlsoHere parts={stack.parts} onPick={(m) => setStack({ for: `${m.blockId}|${m.key}`, parts: [selected, ...stack.parts.filter((x) => x !== m)] })} />}
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
          <NumberField label="Width in per cent" value={width} unit="%" step={5} min={20} max={100} onCommit={(w) => setLook({ width: w })} />
        </span>
      ) : null}
      {isImage && (
        <span className="ctx-group" role="group" aria-label="Angle" title="Turn the image. Or drag the round handle above it.">
          <RotateIcon />
          <NumberField label="Angle in degrees" value={angle} unit="°" step={0.5} min={-180} max={180} onCommit={(rotate) => setLook({ rotate })} />
        </span>
      )}
      {isImage ? null : (
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
      <SelectMore />
      <button type="button" className="ctx-btn ctx-reset" aria-label="Reset changes" disabled={from(...LOOKS) !== 'here'} onClick={resetAll} title={`Reset: undo every change to this at ${SCREEN_LABEL[screen]} size`}><ResetIcon /><span className="ctx-reset-word">Reset</span></button>
      <span className="ctx-gap" />
      {where}
      {more}
      <button type="button" className="ctx-icon" aria-label="Done, deselect (Esc)" title="Done (Esc)" onClick={() => select(null)}>✕</button>
      {live}
    </div>
  )
}

// ---- Several elements selected (Shift-click): the settings they can share, applied to all at once.

// Lining up a group: each part keeps its place in the page's layout and is offset (its position
// setting, per screen size) so that its edge, centre or spacing matches the others. Shared parts
// (category names) cannot move, so they are left out.
type Arrange = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom' | 'across' | 'down'
const ARRANGE: [Arrange, string][] = [['left', 'Align left edges'], ['centre', 'Align centres'], ['right', 'Align right edges'], ['top', 'Align tops'], ['middle', 'Align middles'], ['bottom', 'Align bottoms'], ['across', 'Space evenly across'], ['down', 'Space evenly down']]
function arrangeMoves(members: Picked[], how: Arrange): { m: Picked; x?: number; y?: number }[] {
  const parts = members.map((m) => ({ m, el: elOfPick(m) })).filter((x): x is { m: Picked; el: HTMLElement } => !!x.el && !x.el.hasAttribute('data-shared'))
  if (parts.length < 2) return []
  const view = parts[0].el.ownerDocument.defaultView!
  const root = parseFloat(view.getComputedStyle(parts[0].el.ownerDocument.documentElement).fontSize) || 16
  const boxes = parts.map(({ m, el }) => {
    const r = el.getBoundingClientRect()
    const look = view.getComputedStyle(el)
    return { m, r, left: parseFloat(look.left) || 0, top: parseFloat(look.top) || 0 }
  })
  const rem = (px: number) => Math.round((px / root) * 100) / 100
  const across = (dx: (b: (typeof boxes)[number]) => number) => boxes.map((b) => ({ m: b.m, x: rem(b.left + dx(b)) }))
  const down = (dy: (b: (typeof boxes)[number]) => number) => boxes.map((b) => ({ m: b.m, y: rem(b.top + dy(b)) }))
  const minL = Math.min(...boxes.map((b) => b.r.left)), maxR = Math.max(...boxes.map((b) => b.r.right))
  const minT = Math.min(...boxes.map((b) => b.r.top)), maxB = Math.max(...boxes.map((b) => b.r.bottom))
  switch (how) {
    case 'left': return across((b) => minL - b.r.left)
    case 'right': return across((b) => maxR - b.r.right)
    case 'centre': return across((b) => (minL + maxR) / 2 - (b.r.left + b.r.right) / 2)
    case 'top': return down((b) => minT - b.r.top)
    case 'bottom': return down((b) => maxB - b.r.bottom)
    case 'middle': return down((b) => (minT + maxB) / 2 - (b.r.top + b.r.bottom) / 2)
    case 'across':
    case 'down': {
      // The first and last stay where they are; the ones between get equal gaps.
      const h = how === 'across'
      const sorted = [...boxes].sort((a, b) => (h ? a.r.left - b.r.left : a.r.top - b.r.top))
      const size = (b: (typeof boxes)[number]) => (h ? b.r.width : b.r.height)
      const start = h ? sorted[0].r.left : sorted[0].r.top
      const end = h ? sorted.at(-1)!.r.right : sorted.at(-1)!.r.bottom
      const gap = (end - start - sorted.reduce((t, b) => t + size(b), 0)) / (sorted.length - 1)
      let at = start
      return sorted.map((b) => {
        const shift = at - (h ? b.r.left : b.r.top)
        at += size(b) + gap
        return h ? { m: b.m, x: rem(b.left + shift) } : { m: b.m, y: rem(b.top + shift) }
      })
    }
  }
}

const elOfPick = (m: Picked) => [...(canvas()?.querySelectorAll<HTMLElement>('[data-el]') ?? [])].find((n) => n.dataset.el === m.key && n.closest('[data-puck-component]')?.getAttribute('data-puck-component') === m.blockId) ?? null
const allSame = <T,>(values: T[]) => values.every((v) => v === values[0])

function GroupBar({ members, screen, apply, where, more, live, onDone, announce }: ReturnType<typeof useGroup> & { where: ReactNode; more: ReactNode; live: ReactNode; onDone: () => void; announce: (text: string) => void }) {
  const looks = members.map((m) => m.shown)
  const text = members.every((m) => !IMAGES.test(m.key))
  const sizes = members.map((m) => currentSize(m.shown, elOfPick(m)))
  const bold = looks.every((l) => (l.weight ?? 0) >= 600)
  const colour = allSame(looks.map((l) => l.colour)) ? looks[0].colour : undefined
  const align = allSame(looks.map((l) => l.align)) ? looks[0].align : undefined
  const place = allSame(looks.map((l) => l.place)) ? looks[0].place : undefined
  const placeAll = members.every((m) => { const n = elOfPick(m); return !!n && !['inline', 'contents'].includes(getComputedStyle(n).display) })
  const hidden = looks.every((l) => l.hidden)
  const changed = members.some((m) => Object.keys(m.own).length)
  const step = (by: number) => apply((m) => ({ size: SIZES[Math.max(0, Math.min(SIZES.length - 1, currentSize(m.shown, elOfPick(m)) + by))] }))
  const [arranging, setArranging] = useState<{ left: number; top: number } | null>(null)
  // A tap or click anywhere else closes the menu.
  useEffect(() => {
    if (!arranging) return
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.ctx-menu, .ctx-arrange')) setArranging(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [arranging])
  const movable = members.filter((m) => !elOfPick(m)?.hasAttribute('data-shared')).length
  const arrange = (how: Arrange, label: string) => {
    setArranging(null)
    const moves = arrangeMoves(members, how)
    apply((m) => { const to = moves.find((v) => v.m.key === m.key && v.m.blockId === m.blockId); return to ? { ...(to.x !== undefined && { x: to.x }), ...(to.y !== undefined && { y: to.y }) } : null })
    announce(`${label}: ${moves.length} parts.`)
  }
  return (
    <div className="ctx" role="toolbar" aria-label={`${members.length} selected parts tools`}>
      <span className="ctx-name">{members.length} selected</span>
      {text && (
        <>
          <span className="ctx-group" role="group" aria-label="Text size">
            <span className="ctx-label ctx-label-plain">Size</span>
            <span className="ctx-stepper">
              <button type="button" aria-label="Smaller text, all selected" title="Smaller" onClick={() => step(-1)}>−</button>
              <output>{allSame(sizes) ? TEXT_SIZES[SIZES[sizes[0]]][0] : 'Mixed'}</output>
              <button type="button" aria-label="Larger text, all selected" title="Larger" onClick={() => step(1)}>+</button>
            </span>
          </span>
          <button type="button" className="ctx-icon" aria-pressed={bold} aria-label="Bold, all selected" title="Bold" onClick={() => apply(() => ({ weight: bold ? 400 : 700 }))}><BoldIcon /></button>
          <span className="ctx-group" role="group" aria-label="Colour">
            <span className="ctx-label ctx-label-plain">Colour</span>
            <Swatches value={colour} onChange={(c) => apply(() => ({ colour: c }))} small />
          </span>
          <span className="ctx-group" role="group" aria-label="Text alignment">
            <span className="ctx-label">Text</span>
            <span className="ctx-segment">
              {ALIGN.map(([v, name, AlignIcon]) => <button key={v} type="button" aria-pressed={align === v} aria-label={`Text: align ${name.toLowerCase()}, all selected`} title={`Align the words ${name.toLowerCase()}`} onClick={() => apply(() => ({ align: v }))}><AlignIcon /></button>)}
            </span>
          </span>
        </>
      )}
      {placeAll && (
        <span className="ctx-group ctx-box" role="group" aria-label="Box position">
          <span className="ctx-label">Box</span>
          <span className="ctx-segment">
            {BOX.map(([v, name, BoxIcon]) => <button key={v} type="button" aria-pressed={place === v} aria-label={`Box: ${name.toLowerCase()} of its area, all selected`} title={`Place each box at the ${name.toLowerCase()} of its area`} onClick={() => apply(() => ({ place: place === v ? undefined : v }))}><BoxIcon /></button>)}
          </span>
        </span>
      )}
      <span className="ctx-arrange" onKeyDown={(e) => { if (e.key === 'Escape' && arranging) { e.preventDefault(); setArranging(null) } }}>
        <button type="button" className="ctx-btn" aria-expanded={!!arranging} aria-haspopup="true" disabled={movable < 2} title="Line the selected parts up, or space them evenly" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setArranging(arranging ? null : { left: r.left, top: r.bottom + 4 }) }}>Arrange <span aria-hidden="true">▾</span></button>
        {/* Drawn at the top level of the page, so no editor panel or control can cover it. */}
        {arranging && createPortal(
          <span className="ctx-menu" role="group" aria-label="Arrange" style={{ left: Math.min(arranging.left, window.innerWidth - 200), top: arranging.top }} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setArranging(null) } }}>
            {ARRANGE.map(([how, label]) => <button key={how} type="button" disabled={(how === 'across' || how === 'down') && movable < 3} title={(how === 'across' || how === 'down') && movable < 3 ? 'Select three or more parts to space them evenly' : undefined} onClick={() => arrange(how, label)}>{label}</button>)}
          </span>,
          document.body,
        )}
      </span>
      <button type="button" className="ctx-btn ctx-hide" aria-pressed={hidden} aria-label={hidden ? `All hidden on ${SCREEN_LABEL[screen]}: show them` : `Hide all on ${SCREEN_LABEL[screen]}`} onClick={() => apply(() => ({ hidden: hidden ? (screen === 'desktop' ? undefined : false) : true }))}><EyeOffIcon /><span className="ctx-reset-word">{hidden ? 'Hidden here' : 'Hide here'}</span></button>
      <button type="button" className="ctx-btn ctx-reset" aria-label="Reset changes, all selected" disabled={!changed} title={`Reset: undo every change to these at ${SCREEN_LABEL[screen]} size`} onClick={() => apply((m) => Object.fromEntries(Object.keys(m.own).map((k) => [k, undefined])))}><ResetIcon /><span className="ctx-reset-word">Reset</span></button>
      <SelectMore />
      <span className="ctx-gap" />
      {where}
      {more}
      <button type="button" className="ctx-icon" aria-label="Done, deselect all (Esc)" title="Done (Esc)" onClick={onDone}>✕</button>
      {live}
    </div>
  )
}

// ---- The side panel ("More settings"): everything for the selection, grouped and labelled.

export function ElementPanel({ p }: { value?: Elements; onChange?: (v: Elements) => void; p: Project }) {
  const { key, item, selected, screen, own, shown, setLook, setProps, from, resetAll, background } = useLook()
  const words = useWords(p)
  const [snapping, setSnapping] = useState(snapOn)
  const { group } = useContext(Selection)

  if (group.length > 1) return <div className="el-panel"><div className="el-head"><p className="el-name">{group.length} parts selected</p><p className="el-note">Settings they share are in the bar above and change all of them at once. Click one part on its own to see all of its settings.</p></div></div>

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
  const el = elFor(selected?.blockId, key)
  const width = shown.width ?? (el ? widthNow(el) : 100)
  const angle = shown.rotate ?? (el && isImage ? angleOf(el) : 0)
  const angleRow = (
    <Row label="Angle" hint="Turns the image. Drag the round handle above it, or type an angle. Shift-drag keeps to steps of 15°." from={from('rotate')} onReset={() => reset('rotate')}>
      <StepField label="Angle" value={angle} unit="°" step={0.5} min={-180} max={180} onCommit={(rotate) => setLook({ rotate })} />
    </Row>
  )
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
          {angleRow}
        </Group>
      ) : isSectionPhoto(item?.type, key) ? (
        <PhotoGroup
          props={item!.props as PhotoProps}
          width={width}
          shown={shown}
          from={from}
          setLook={setLook}
          setProps={setProps}
          reset={reset}
          measure={() => elFor(selected?.blockId, key)?.getBoundingClientRect().width ?? 0}
          angleRow={angleRow}
        />
      ) : isImage ? (
        <Group title="Image">
          <Row label="Width" from={from('width')} onReset={() => reset('width')}>
            <input type="range" min={20} max={100} step={5} value={width} aria-label="Width" aria-valuetext={`${width}%`} onChange={(e) => setLook({ width: Number(e.target.value) })} />
            <NumberField label="Width in per cent" value={width} unit="%" step={5} min={20} max={100} onCommit={(w) => setLook({ width: w })} />
          </Row>
          {angleRow}
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
          <StepField label="Across" value={Math.round((shown.x ?? 0) * 16)} unit="px" step={4} min={-4000} max={4000} onCommit={(n) => setLook({ x: n ? round(n / 16) : undefined })} />
        </Row>
        <Row label="Down" from={from('y')} onReset={() => reset('y')}>
          <StepField label="Down" value={Math.round((shown.y ?? 0) * 16)} unit="px" step={4} min={-4000} max={4000} onCommit={(n) => setLook({ y: n ? round(n / 16) : undefined })} />
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

// The photo in an Image section: its size on each screen, the shape of its frame, and, in a frame of
// a fixed shape, whether it fills the frame (cropped, with a crop focus) or shows whole. Shape and fit
// are the same on every screen size; the width can differ. The photo file itself is never changed.
type PhotoProps = { image?: string; ratio?: string; fit?: 'cover' | 'contain'; design?: { width?: string } & Record<string, unknown> }
export const isSectionPhoto = (type: string | undefined, key: string | null) => type === 'Image' && key === 'photo'
const SIZE_PRESETS: [string, string][] = [['narrow', 'Narrow'], ['text', 'Text column'], ['wide', 'Wide'], ['full', 'Full']]
const SHAPES = ratioOptions.map((o) => [o.value, o.label] as [string, string])
const FITS: [string, string][] = [['cover', 'Fill the frame'], ['contain', 'Show the whole photo']]
function PhotoGroup({ props, width, shown, from, setLook, setProps, reset, measure, angleRow }: {
  props: PhotoProps; width: number; shown: ElementLook; from: (...k: (keyof ElementLook)[]) => string
  setLook: (patch: Partial<ElementLook>) => void; setProps: (patch: Record<string, unknown>) => void
  reset: (...k: (keyof ElementLook)[]) => void; measure: () => number; angleRow: ReactNode
}) {
  const ratio = props.ratio ?? 'auto'
  const setSize = (w: string) => { const design = { ...(props.design ?? {}) }; if (w === 'full') delete design.width; else design.width = w; setProps({ design }) }
  const fit = ratio === 'auto' ? 'cover' : props.fit ?? 'cover'
  // A photo shown wider than its original looks soft; say so rather than let it happen unnoticed.
  const original = photoSize(props.image)?.width ?? 0
  // Measured once the page has drawn the latest change, so the note never lags a step behind.
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => requestAnimationFrame(() => setDisplayed(Math.round(measure())))); return () => cancelAnimationFrame(id) })
  const soft = original > 0 && displayed > original
  return (
    <Group title="Photo">
      <Row label="Size" hint="The space the photo can fill on larger screens. Phones use their full width unless you set Phone below." from="design" onReset={() => {}}>
        <Segments label="Size" value={props.design?.width ?? 'full'} options={SIZE_PRESETS} onChange={setSize} />
      </Row>
      <Row label="Width on this screen" hint="A share of that space, for this screen size only." from={from('width')} onReset={() => reset('width')}>
        <input type="range" min={20} max={100} step={5} value={width} aria-label="Width" aria-valuetext={`${width}%`} onChange={(e) => setLook({ width: Number(e.target.value) })} />
        <NumberField label="Width in per cent" value={width} unit="%" step={5} min={20} max={100} onCommit={(w) => setLook({ width: w })} />
      </Row>
      {soft && <p className="el-warning" role="note">Shown wider than the original photo ({original} px), so it may look soft. Choose a smaller size.</p>}
      <Row label="Shape" hint="The same on every screen size." from={ratio === 'auto' ? 'design' : 'here'} onReset={() => setProps({ ratio: 'auto', fit: 'cover' })}>
        <select className="el-select" aria-label="Shape" value={ratio} onChange={(e) => setProps({ ratio: e.target.value })}>
          {SHAPES.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
        </select>
      </Row>
      {ratio !== 'auto' && (
        <Row label="Fit" hint={fit === 'cover' ? 'The photo fills the frame; the edges that do not fit are hidden.' : 'All of the photo shows; the background fills the rest of the frame.'} from={fit === 'cover' ? 'design' : 'here'} onReset={() => setProps({ fit: 'cover' })}>
          <Segments label="Fit" value={fit} options={FITS} onChange={(f) => setProps({ fit: f })} />
        </Row>
      )}
      {ratio !== 'auto' && fit === 'cover' && (
        <Row label="Crop focus" hint="The part of the photo kept in view." from={from('focusX', 'focusY')} onReset={() => reset('focusX', 'focusY')}>
          <FocusGrid x={shown.focusX ?? 50} y={shown.focusY ?? 50} onChange={(focusX, focusY) => setLook({ focusX, focusY })} />
        </Row>
      )}
      {angleRow}
    </Group>
  )
}

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

// Parts under the one just clicked (behind it, or around it), to choose one that is hard to click.
function AlsoHere({ parts, onPick }: { parts: Picked[]; onPick: (m: Picked) => void }) {
  const { select } = useContext(Selection)
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const wrap = useRef<HTMLSpanElement>(null)
  const menu = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!at) return
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node)) setAt(null) }
    document.addEventListener('pointerdown', away)
    menu.current?.querySelector('button')?.focus()
    return () => document.removeEventListener('pointerdown', away)
  }, [at])
  return (
    <span className="ctx-arrange" ref={wrap} onKeyDown={(e) => { if (e.key === 'Escape' && at) { e.preventDefault(); setAt(null); wrap.current?.querySelector('button')?.focus() } }}>
      <button type="button" className="ctx-btn ctx-also" aria-expanded={!!at} aria-haspopup="true" title="Other parts at the place you clicked: choose one that is hard to click" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setAt(at ? null : { left: r.left, top: r.bottom + 4 }) }}>
        <LayersIcon /><span>Also here ({parts.length})</span> <span aria-hidden="true">▾</span>
      </button>
      {at && createPortal(
        <span className="ctx-menu" ref={menu} role="group" aria-label="Also here" style={{ left: Math.min(at.left, window.innerWidth - 220), top: at.top }} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setAt(null) } }}>
          {parts.map((m) => <button key={`${m.blockId}|${m.key}`} type="button" onClick={() => { setAt(null); onPick(m); select(m) }}>{nameOf(m.key)}</button>)}
        </span>,
        document.body,
      )}
    </span>
  )
}

// A number you can type (Enter or leaving the field applies it; Escape puts it back), or change
// with the arrow keys (Shift for ten steps). Each applied number is one step to undo.
function NumberField({ label, value, unit, step, min, max, onCommit }: { label: string; value: number; unit: string; step: number; min: number; max: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = String(Math.round(value * 100) / 100)
  const apply = (text: string) => {
    setDraft(null)
    const n = Number(text.replace('−', '-'))
    if (text.trim() === '' || !Number.isFinite(n)) return
    const next = Math.min(max, Math.max(min, n))
    if (next !== value) onCommit(next)
  }
  return (
    <span className="num-field">
      <input type="text" inputMode="decimal" aria-label={label} value={draft ?? shown}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => { if (draft !== null) apply(e.target.value) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); apply(e.currentTarget.value) }
          else if (e.key === 'Escape' && draft !== null) { e.preventDefault(); e.stopPropagation(); setDraft(null) }
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const base = Number((draft ?? shown).replace('−', '-'))
            apply(String((Number.isFinite(base) ? base : value) + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)))
          }
        }} />
      <span className="num-unit" aria-hidden="true">{unit}</span>
    </span>
  )
}
// The same, with − and + buttons for touch.
function StepField(props: Parameters<typeof NumberField>[0]) {
  const { label, value, step, min, max, onCommit } = props
  return (
    <div className="el-step">
      <button type="button" aria-label={`${label}: less`} onClick={() => onCommit(Math.max(min, Math.round((value - step) * 100) / 100))}>−</button>
      <NumberField {...props} />
      <button type="button" aria-label={`${label}: more`} onClick={() => onCommit(Math.min(max, Math.round((value + step) * 100) / 100))}>+</button>
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
