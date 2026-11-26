import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createUsePuck } from '@puckeditor/core'
import type { Project } from '#/lib/site'
import { allCategories } from '../../.content-collections/generated'

// Read straight from the content, so the saving code (and its tests) do not load the whole site.
const categoryName = (slug: string) => allCategories.find((c) => c.slug === slug)?.name ?? slug
import { boxOf, clearGuides, describeSnap, drawGuides, linesFor, snap, type Box } from './guides'
import { LABELS, type LabelKey } from '#/layout/labels'
import { MOD, fillBox, readBox, report, setTypingBox, splitRich, takeStartAtEnd } from './formatting'

// Editing single elements on the page: click one to select it, double-click its words to change
// them, then style it in the "Selected element" panel or move it with the arrow keys.
//
// Changed words are kept in the page data (root.props.edits) until publishing, so undo, redo,
// drafts and unsaved-work recovery cover them; publishing writes them to the project's content file.
// Names use ':' and '-' rather than dots, because the editor reads dots in names as nested data.

const usePuck = createUsePuck()

export type Edits = Record<string, string>
export type Picked = { key: string; blockId: string; field?: string }
type Selected = Picked | null
// The parts of a section, in page order, read from the markers every part carries on the page. A part
// belongs to the nearest block around it (a column of a grid is its own block). Used by Sections.
export function partsOf(blockId: string): Picked[] {
  const doc = (document.getElementById('preview-frame') as HTMLIFrameElement | null)?.contentDocument
  const root = doc?.querySelector(`[data-puck-component="${blockId}"]`)
  if (!root) return []
  const seen = new Set<string>()
  return [...root.querySelectorAll<HTMLElement>('[data-el]')].flatMap((el) => {
    const owner = el.closest('[data-puck-component]')?.getAttribute('data-puck-component') ?? blockId
    const id = `${owner}|${el.dataset.el}`
    if (seen.has(id)) return []
    seen.add(id)
    return [{ key: el.dataset.el!, blockId: owner, field: el.dataset.edit }]
  })
}
const same = (a: Picked, b: Picked) => a.key === b.key && a.blockId === b.blockId

// One element is "selected" (its settings show in the panel). Shift-click adds more to a group;
// the group moves and takes shared settings together. The last one added is the selected one.
// On a touchscreen there is no Shift key, so "Select more" makes each tap add or remove instead.
type SelectionValue = { selected: Selected; group: Picked[]; select: (s: Selected) => void; toggle: (s: Picked) => void; adding: boolean; setAdding: (on: boolean) => void }
export const Selection = createContext<SelectionValue>({ selected: null, group: [], select: () => {}, toggle: () => {}, adding: false, setAdding: () => {} })
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [{ selected, group }, set] = useState<{ selected: Selected; group: Picked[] }>({ selected: null, group: [] })
  const [adding, setAdding] = useState(false)
  const select = useCallback((s: Selected) => { set({ selected: s, group: [] }); if (!s) setAdding(false) }, [])
  const toggle = useCallback((s: Picked) => set((now) => {
    const members = now.group.length ? now.group : now.selected ? [now.selected] : []
    const next = members.some((m) => same(m, s)) ? members.filter((m) => !same(m, s)) : [...members, s]
    return { selected: next.at(-1) ?? null, group: next.length > 1 ? next : [] }
  }), [])
  return <Selection.Provider value={{ selected, group, select, toggle, adding, setAdding }}>{children}</Selection.Provider>
}

const NAMES: [RegExp, string][] = [
  [/^photo$/, 'Photo'],
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
  // Homepage, About, Projects, category pages, header and footer
  [/^intro$/, 'Introduction'],
  [/^intro-more$/, 'More about you'],
  [/^clock$/, 'Clock'],
  [/^portrait$/, 'Portrait'],
  [/^focus-(\d+)$/, 'Area of focus'],
  [/^languages-heading$/, 'Languages heading'],
  [/^language-(\d+)$/, 'Language'],
  [/^edu-qualification-(\d+)$/, 'Qualification'],
  [/^edu-course-(\d+)$/, 'Course'],
  [/^edu-institution-(\d+)$/, 'Institution'],
  [/^edu-years-(\d+)$/, 'Years'],
  [/^edu-result-(\d+)$/, 'Result'],
  [/^edu-note-(\d+)$/, 'Education note'],
  [/^role-years-(\d+)$/, 'Role years'],
  [/^role-org-(\d+)$/, 'Organisation'],
  [/^role-note-(\d+)$/, 'Role description'],
  [/^email$/, 'Email address'],
  [/^social-instagram$/, 'Instagram link'],
  [/^social-linkedin$/, 'LinkedIn link'],
  [/^page-(home|about|projects)$/, 'Page link'],
  [/^credit$/, 'Copyright line'],
  [/^availability$/, 'Availability line'],
  [/^byline$/, 'Name and title'],
  [/^cv-view$/, '"View CV" link'],
  [/^cv-download$/, '"Download" link'],
  [/^focus-heading$/, 'Areas of Focus heading'],
  [/^work-heading$/, 'Selected Projects heading'],
  [/^intro-heading$/, 'Intro heading'],
  [/^skills-heading$/, 'Skills heading'],
  [/^education-heading$/, 'Education heading'],
  [/^experience-heading$/, 'Experience heading'],
  [/^skill-note-(\d+)$/, 'Skill description'],
  [/^skill-(\d+)$/, 'Skill'],
  [/^role-(\d+)$/, 'Role'],
  [/^name$/, 'Site name'],
  [/^nav-about$/, 'Menu: About'],
  [/^nav-projects$/, 'Menu: Projects'],
  [/^nav-cv$/, 'Menu: CV'],
  [/^nav-email$/, 'Menu: Email'],
  [/^nav-instagram$/, 'Menu: Instagram'],
  [/^nav-linkedin$/, 'Menu: LinkedIn'],
  [/^top$/, '"Back to top" link'],
]
// On the homepage the introduction's first part is the headline (26 Nov 2026), with the name line under it.
const ON_HOME = (() => { try { return new URLSearchParams(location.search).get('page') === 'home' } catch { return false } })()
export const nameOf = (key: string) => {
  if (key === 'intro' && ON_HOME) return 'Headline'
  const category = key.match(/^cat-(.+)$/)
  if (category) return `"${categoryName(category[1])}" category name`
  const fact = key.match(/^(label|value)-(role|type|when|deliverables|tools)$/)
  if (fact) return fact[1] === 'label' ? `"${LABELS[fact[2] as LabelKey]}" label` : `${LABELS[fact[2] as LabelKey]} fact`
  const match = NAMES.find(([re]) => re.test(key))
  const n = key.match(/(\d+)$/)
  return match ? `${match[1]}${n ? ` ${Number(n[1]) + 1}` : ''}` : key
}
export const IMAGES = /^(image|image-\d+|moodboard|key|context|film|photo)$/

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
// Category names are shared: they live in the category's own file and show on every page.
export const CATEGORY_FIELD = /^category:(.+)$/
export const categoryEdits = (edits: Edits) => Object.entries(edits).filter(([field]) => CATEGORY_FIELD.test(field))
export const wordsOf = (p: Project, field: string, edits: Edits = {}) => {
  if (field in edits) return edits[field]
  const category = field.match(CATEGORY_FIELD)
  return category ? categoryName(category[1]) : wordsAt(field, fromObject(p))
}

// Where changed words are written: one or more paths in the content file and their values.
export function writesFor(field: string, words: string): [(string | number)[], unknown][] {
  if (field === 'type') {
    const [kind = '', ...detail] = splitRich(words, ' · ')
    return [[['project_type'], kind], [['type_detail'], detail.join(' · ') || undefined]]
  }
  if (SEPARATOR[field]) return [[[field], splitRich(words, SEPARATOR[field].trim())]]
  return [[keysOf(field), words]]
}

export function applyEdits(p: Project, edits: Edits = {}): Project {
  if (!Object.keys(edits).length) return p
  const copy = structuredClone(p) as Record<string, unknown>
  for (const [field, words] of Object.entries(edits)) {
    if (CATEGORY_FIELD.test(field)) continue
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
export function useWords(p: Project) {
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
export const moveListeners = new Set<(x: number, y: number) => void>()
// A group moved together: each member's new position, saved as one change (one undo step).
export type GroupMove = Picked & { x: number; y: number }
export const groupMoveListeners = new Set<(moves: GroupMove[]) => void>()
export const announceListeners = new Set<(text: string) => void>()

// Snapping to guides is on unless switched off in the panel; holding Option (Alt) moves freely.
const SNAP_KEY = 'design-editor:snap'
export const snapOn = () => { try { return localStorage.getItem(SNAP_KEY) !== 'off' } catch { return true } }
export const setSnapOn = (on: boolean) => { try { localStorage.setItem(SNAP_KEY, on ? 'on' : 'off') } catch { /* stays on for this visit */ } }
export const round = (n: number) => Math.round(n * 100) / 100
const shift = (b: Box, dx: number, dy: number): Box => ({ left: b.left + dx, right: b.right + dx, top: b.top + dy, bottom: b.bottom + dy, baseline: b.baseline === undefined ? undefined : b.baseline + dy })

// The width an element would have at 100%: image widths are a share of the space they sit in,
// which for a grid item is its grid area, so it is measured rather than worked out.
export function fullWidth(el: HTMLElement) {
  const { width, maxWidth } = el.style
  el.style.width = '100%'
  el.style.maxWidth = 'none'
  const full = el.getBoundingClientRect().width
  el.style.width = width
  el.style.maxWidth = maxWidth
  return full || 1
}
export const widthNow = (el: HTMLElement) => Math.round((el.getBoundingClientRect().width / fullWidth(el)) * 20) * 5

// ---- On the page: hovering, selecting, editing words, moving

// Image widths changed by dragging the handle reach the panel the same way as moves.
export const widthListeners = new Set<(width: number) => void>()
// An image's angle in degrees as shown now: a cover's own tilt, or the turn of the whole part.
export function angleOf(el: HTMLElement) {
  const view = el.ownerDocument.defaultView!
  const tilt = el.children.length === 1 && el.firstElementChild!.classList.contains('tilt') ? (el.firstElementChild as HTMLElement) : null
  if (tilt) return parseFloat(view.getComputedStyle(tilt).getPropertyValue('--tilt')) || 2
  return parseFloat(view.getComputedStyle(el).rotate) || 0
}
// Shows an angle on the page while it is being chosen, without saving it (null puts it back).
export function previewAngle(el: HTMLElement, deg: number | null) {
  const tilt = el.children.length === 1 && el.firstElementChild!.classList.contains('tilt') ? (el.firstElementChild as HTMLElement) : null
  if (tilt) {
    if (deg === null) { tilt.style.removeProperty('--tilt'); if (tilt.dataset.tilt) tilt.style.setProperty('--tilt', tilt.dataset.tilt) }
    else { if (tilt.dataset.tilt === undefined) tilt.dataset.tilt = tilt.style.getPropertyValue('--tilt'); tilt.style.setProperty('--tilt', `${deg}deg`, 'important') }
  } else el.style.rotate = deg === null ? '' : `${deg}deg`
}
// Angles chosen with the rotate handle reach the panel the same way as moves.
export const rotateListeners = new Set<(deg: number) => void>()
export const formatAngle = (deg: number) => `${Math.round(deg * 10) / 10}°`.replace('-', '−')

// The other parts under the point last clicked (largest last), so a part hidden behind another
// can be chosen from a list instead of by clicking.
export const stackListeners = new Set<(parts: Picked[], picked: Picked | null) => void>()

// A project's opening cover changes size in steps; dragging its handle reports how many steps.
export const coverListeners = new Set<(steps: number) => void>()
const COVER_VW: Record<number, number> = { 3: 20, 4: 26, 5: 32, 6: 38 }
const px = (n: number) => `${Math.round(n)} px`

export function useCanvasEditing(p: Project, edits: Edits) {
  // The page frame can be redrawn by the editor, so listen on whichever document holds it now.
  const [doc, setDoc] = useState<Document | null>(null)
  const anchor = (node: HTMLSpanElement | null) => setDoc(node?.ownerDocument ?? null)
  const { selected, group, select, toggle, adding } = useContext(Selection)
  const words = useWords(p)
  const latest = useRef({ edits, words, selected, group, adding })
  latest.current = { edits, words, selected, group, adding }

  useEffect(() => {
    if (!doc) return
    const view = doc.defaultView!
    const html = doc.documentElement
    // The preview is shown scaled down; editor marks are drawn at a steady on-screen size.
    const scale = () => {
      const frame = view.frameElement as HTMLElement | null
      return (frame ? frame.getBoundingClientRect().width / html.clientWidth : 1) || 1
    }
    const pagePixels = (n: number) => n / scale()
    const rootSize = () => parseFloat(view.getComputedStyle(html).fontSize) || 16

    // Words are framed tightly; a heading that spans the column is outlined around its words only.
    const visualBox = (el: HTMLElement) => {
      const box = el.getBoundingClientRect()
      if (!el.dataset.edit || [...el.children].some((c) => view.getComputedStyle(c).display !== 'inline')) return box
      const range = doc.createRange()
      range.selectNodeContents(el)
      const words = range.getBoundingClientRect()
      if (!words.width) return box
      const left = Math.max(box.left, words.left)
      return { left, top: box.top, width: Math.max(Math.min(box.right, words.right) - left, 8), height: box.height, bottom: box.bottom, right: Math.min(box.right, words.right) }
    }
    // Puck switches off pointer events inside blocks while editing, so find the element by
    // position: the smallest marked element under the pointer, judged by what you can see of it.
    const elementAt = (x: number, y: number) => {
      let best: HTMLElement | undefined
      let bestArea = Infinity
      for (const el of doc.querySelectorAll<HTMLElement>('[data-el]')) {
        const r = visualBox(el)
        if (x < r.left || x > r.left + r.width || y < r.top || y > r.top + r.height || !r.width) continue
        if (r.width * r.height < bestArea) { best = el; bestArea = r.width * r.height }
      }
      return best
    }
    const blockOf = (el: HTMLElement) => el.closest('[data-puck-component]')?.getAttribute('data-puck-component') ?? ''
    let dragged = false
    const pickOf = (el: HTMLElement): Picked => ({ key: el.dataset.el!, blockId: blockOf(el), field: el.dataset.edit })
    // The group's elements on the page; shared names never move, so they are left out of moves.
    const elOf = (m: Picked) => [...doc.querySelectorAll<HTMLElement>('[data-el]')].find((n) => n.dataset.el === m.key && blockOf(n) === m.blockId)
    const movable = () => latest.current.group.map((m) => ({ m, el: elOf(m) })).filter((x): x is { m: Picked; el: HTMLElement } => !!x.el && !x.el.hasAttribute('data-shared'))
    const grouped = () => latest.current.group.length > 1

    // Marks drawn over the page: a light outline on hover, a frame on the selected element.
    const layer = (cls: string) => {
      let n = doc.querySelector<HTMLElement>(`.${cls}`)
      if (!n) {
        n = doc.createElement('div')
        n.className = cls
        n.setAttribute('aria-hidden', 'true')
        const tag = doc.createElement('span')
        tag.className = 'el-tag'
        n.append(tag)
        doc.body.append(n)
      }
      return n
    }
    const place = (n: HTMLElement, el: HTMLElement) => {
      const r = visualBox(el)
      Object.assign(n.style, { left: `${r.left + view.scrollX}px`, top: `${r.top + view.scrollY}px`, width: `${r.width}px`, height: `${r.height}px`, display: 'block' })
      // A turned image's frame turns with it (its name tag stays level), as in Canva and Figma.
      // Near the top of the page the rotate handle would be out of reach, so it sits below instead.
      if (n.classList.contains('el-frame')) n.toggleAttribute('data-rotate-below', r.top + view.scrollY < pagePixels(48))
      const turned = n.classList.contains('el-frame') && IMAGES.test(el.dataset.el ?? '') && !grouped() ? angleOf(el) : 0
      n.style.rotate = turned ? `${turned}deg` : ''
      const tag = n.querySelector<HTMLElement>('.el-tag')
      if (tag) tag.style.rotate = turned ? `${-turned}deg` : ''
    }
    const tagOf = (n: HTMLElement) => n.querySelector<HTMLElement>('.el-tag')!
    const hide = (n: HTMLElement | null) => { if (n) n.style.display = 'none' }

    const previewing = () => html.hasAttribute('data-preview')
    const onPointerMove = (e: PointerEvent) => {
      if (previewing()) return
      if (doc.querySelector('.el-typing') || (e.target as HTMLElement).closest?.('.el-frame, .el-gframe')) { hide(doc.querySelector('.el-hover')); html.removeAttribute('data-el-over'); return }
      const el = elementAt(e.clientX, e.clientY)
      if (!el || el.hasAttribute('data-el-selected') || el.hasAttribute('data-el-group')) {
        hide(doc.querySelector('.el-hover'))
        html.removeAttribute('data-el-over')
        return
      }
      html.setAttribute('data-el-over', '')
      const hover = layer('el-hover')
      place(hover, el)
      tagOf(hover).textContent = el.dataset.edit ? `${nameOf(el.dataset.el!)} · double-click to edit` : nameOf(el.dataset.el!)
    }
    const onPointerLeave = () => { hide(doc.querySelector('.el-hover')); html.removeAttribute('data-el-over') }

    const onClick = (e: MouseEvent) => {
      // A link on the page never leaves the editor (Enter on a focused link sends a click too):
      // another page would replace the one being edited. Jumps within the page (#outcomes) still work.
      const link = (e.target as HTMLElement).closest?.<HTMLAnchorElement>('a[href]')
      const href = link?.getAttribute('href') ?? ''
      // A jump within the page scrolls to its section here (the page is not a real address, so the
      // browser's own jump would reload it).
      if (link && href.startsWith('#')) {
        e.preventDefault()
        const target = href.length > 1 ? doc.getElementById(decodeURIComponent(href.slice(1))) : null
        target?.scrollIntoView({ block: 'start' })
        if (e.detail === 0 || previewing()) return
      } else if (link) {
        e.preventDefault()
        if (e.detail === 0) {
          announceListeners.forEach((fn) => fn('Links to other pages open on the website, not in the editor.'))
          // From the keyboard, Enter on a link selects the part it belongs to, as a click would.
          const part = link.closest<HTMLElement>('[data-el]')
          if (part && !previewing()) select(pickOf(part))
          return
        }
      }
      // The second click of a double-click never changes the selection: the double-click types.
      if (previewing() || e.detail > 1) return
      if (dragged) { dragged = false; return }
      const more = e.shiftKey || latest.current.adding
      const onFrame = (e.target as HTMLElement).closest?.('.el-frame, .el-gframe')
      if (onFrame && !more) return
      const el = elementAt(e.clientX, e.clientY)
      // Shift-click (or a tap with "Select more" on) adds an element to the group, or takes it out again.
      if (more && el) {
        if (el.hasAttribute('data-shared')) { announceListeners.forEach((fn) => fn('Shared names are changed on their own, so they cannot join a group.')); return }
        toggle(pickOf(el))
        hide(doc.querySelector('.el-hover'))
        return
      }
      if (onFrame) return
      // A click on an empty part of a section selects the section itself.
      if (!el) { select(null); stackListeners.forEach((fn) => fn([], null)); return }
      select(pickOf(el))
      const under = [...doc.querySelectorAll<HTMLElement>('[data-el]')]
        .filter((n) => n !== el && !n.contains(el) && !el.contains(n))
        .map((n) => ({ n, r: visualBox(n) }))
        .filter(({ r }) => r.width > 0 && e.clientX >= r.left && e.clientX <= r.left + r.width && e.clientY >= r.top && e.clientY <= r.top + r.height)
        .sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height)
        .map(({ n }) => pickOf(n))
      stackListeners.forEach((fn) => fn(under, pickOf(el)))
      hide(doc.querySelector('.el-hover'))
    }

    // Words are typed into a copy laid exactly over the element, in the same type, so the page
    // itself is only ever redrawn from the saved words.
    const startTyping = (el: HTMLElement) => {
      if (!el.dataset.edit || doc.querySelector('.el-typing')) return
      const field = el.dataset.edit
      const r = el.getBoundingClientRect()
      const look = view.getComputedStyle(el)
      const box = doc.createElement('div')
      box.className = 'el-typing'
      const blockId = blockOf(el)
      // Words that the page shows with formatting are typed with it too (bold, italic, underline);
      // titles, headings and labels are plain words.
      const rich = el.hasAttribute('data-rich')
      if (rich) fillBox(box, latest.current.words.read(field, blockId))
      else box.textContent = latest.current.words.read(field, blockId)
      Object.assign(box.style, {
        left: `${r.left + view.scrollX}px`, top: `${r.top + view.scrollY}px`, width: `${Math.max(r.width, 120)}px`, minHeight: `${r.height}px`,
        font: look.font, letterSpacing: look.letterSpacing, textTransform: look.textTransform, lineHeight: look.lineHeight, color: look.color, textAlign: look.textAlign,
      })
      if (rich) box.contentEditable = 'true'
      else try { box.contentEditable = 'plaintext-only' } catch { box.contentEditable = 'true' }
      box.setAttribute('role', 'textbox')
      box.setAttribute('aria-label', `${nameOf(el.dataset.el!)}: edit the words, then press Enter`)
      const help = doc.createElement('span')
      help.className = 'el-tag el-tag-help'
      help.setAttribute('aria-hidden', 'true')
      help.textContent = rich ? `Enter to finish · Esc to cancel · ${MOD}B, ${MOD}I, ${MOD}U to format` : 'Enter to finish · Esc to cancel'
      Object.assign(help.style, { left: `${r.left + view.scrollX}px`, top: `${r.bottom + view.scrollY}px` })
      el.setAttribute('data-el-editing', '')
      html.setAttribute('data-el-typing', '')
      doc.body.append(box, help)
      box.focus()
      if (takeStartAtEnd()) { doc.getSelection()?.selectAllChildren(box); doc.getSelection()?.collapseToEnd() }
      else doc.getSelection()?.selectAllChildren(box)
      if (rich) setTypingBox(box)
      const onSelection = () => report()
      if (rich) doc.addEventListener('selectionchange', onSelection)
      let done = false
      const finish = (keep: boolean) => {
        if (done) return
        done = true
        const words = rich ? readBox(box) : (box.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (rich) { doc.removeEventListener('selectionchange', onSelection); setTypingBox(null) }
        box.remove()
        help.remove()
        el.removeAttribute('data-el-editing')
        html.removeAttribute('data-el-typing')
        if (keep && words) latest.current.words.write(field, words, blockId)
        announceListeners.forEach((fn) => fn(keep ? 'Words changed.' : 'Typing cancelled; nothing changed.'))
      }
      box.addEventListener('keydown', (k) => {
        k.stopPropagation()
        if (k.key === 'Enter' && !k.shiftKey) { k.preventDefault(); finish(true) }
        if (k.key === 'Escape') { k.preventDefault(); finish(false) }
        // Cmd/Ctrl+B, I and U format the selected words (or what is typed next); plain words have none.
        const command = (k.metaKey || k.ctrlKey) && !k.altKey && ({ b: 'bold', i: 'italic', u: 'underline' } as const)[k.key.toLowerCase() as 'b' | 'i' | 'u']
        if (command) {
          k.preventDefault()
          if (rich) { doc.execCommand('styleWithCSS', false, 'false'); doc.execCommand(command); report() }
        }
      })
      // Pasted words arrive as plain words, so formatting from elsewhere never comes with them.
      box.addEventListener('paste', (p) => {
        p.preventDefault()
        doc.execCommand('insertText', false, (p.clipboardData?.getData('text/plain') ?? '').replace(/\s+/g, ' '))
      })
      box.addEventListener('blur', () => finish(true))
    }
    const onDoubleClick = (e: MouseEvent) => {
      if (previewing()) return
      const el = elementAt(e.clientX, e.clientY)
      if (!el?.dataset.edit) return
      e.preventDefault()
      if (!el.hasAttribute('data-el-selected')) select({ key: el.dataset.el!, blockId: blockOf(el), field: el.dataset.edit })
      startTyping(el)
    }

    // Where the selected element is now: its offset in pixels at this screen size.
    const offsetOf = (el: HTMLElement) => {
      const look = view.getComputedStyle(el)
      return [parseFloat(look.left) || 0, parseFloat(look.top) || 0]
    }
    const commit = (leftPx: number, topPx: number, words: string) => {
      const root = rootSize()
      moveListeners.forEach((fn) => fn(round(leftPx / root), round(topPx / root)))
      announceListeners.forEach((fn) => fn(words))
    }
    const commitGroup = (moves: (Picked & { left: number; top: number })[], words: string) => {
      const root = rootSize()
      groupMoveListeners.forEach((fn) => fn(moves.map(({ left, top, ...m }) => ({ ...m, x: round(left / root), y: round(top / root) }))))
      announceListeners.forEach((fn) => fn(words))
    }
    const selectedEl = () => doc.querySelector<HTMLElement>('[data-el-selected]')
    const movedText = (left: number, top: number) => `${px(left)} across, ${px(top)} down`

    const onKeyDown = (e: KeyboardEvent) => {
      if (!latest.current.selected) return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, button, [contenteditable]')) return
      const el = selectedEl()
      if (!el) return
      if (e.key === 'Escape') { e.preventDefault(); select(null); return }
      const step = (e.shiftKey ? 1 : 0.25) * rootSize()
      const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
      if (grouped()) {
        // A group moves by the same amount, without snapping, as one change.
        const parts = movable()
        if (!move[e.key] || !parts.length) return
        e.preventDefault()
        const [dx, dy] = move[e.key]
        commitGroup(parts.map(({ m, el: n }) => { const [l, t] = offsetOf(n); return { ...m, left: l + dx, top: t + dy } }), `Moved ${parts.length} parts together.`)
        return
      }
      if (e.key === 'Enter' && el.dataset.edit) { e.preventDefault(); startTyping(el); return }
      if (!move[e.key] || el.hasAttribute('data-shared')) return
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
      commit(left + dx, top + dy, describeSnap(s) || `Moved: ${movedText(left + dx, top + dy)}.`)
    }

    // Dragging the selected element moves only that element; guides show what it lines up with.
    // The handle on an image's right edge changes its width instead.
    const onFrameDown = (e: PointerEvent) => {
      const frame = (e.target as HTMLElement).closest?.('.el-frame, .el-gframe') as HTMLElement | null
      const el = selectedEl()
      if (!frame || !el || e.button !== 0 || e.shiftKey) return
      // Pressing on the frame keeps the browser from moving focus, so hand it to the page here:
      // otherwise arrow keys would still go to the last toolbar button used.
      view.focus()
      // With "Select more" on, a group can still be dragged; a tap without moving adds or removes.
      if (grouped()) { dragGroup(e, frame, el); return }
      if (latest.current.adding) return
      if (el.hasAttribute('data-shared')) return
      e.preventDefault()
      e.stopPropagation()
      frame.setPointerCapture(e.pointerId)
      const tag = tagOf(frame)
      const name = tag.textContent ?? ''
      const [x0, y0] = [e.clientX, e.clientY]
      const resizing = (e.target as HTMLElement).classList.contains('el-handle')
      if ((e.target as HTMLElement).classList.contains('el-rotate')) { rotate(e, frame, el); return }
      const [left, top] = offsetOf(el)
      const start = boxOf(el)
      const lines = linesFor(el, nameOf)
      const space = fullWidth(el)
      const startWidth = el.getBoundingClientRect().width
      let moved = false
      let last = { dx: 0, dy: 0, s: snap(start, { across: [], down: [] }, 0) }
      let width = 0
      // The opening cover moves through its sizes, one grid column at a time (50px steps on phones).
      const cover = resizing && el.classList.contains('cs-open-visual')
      const grid = el.parentElement
      const stacked = !grid || view.getComputedStyle(grid).display !== 'grid'
      const column = stacked ? 50 : (grid.getBoundingClientRect().width || 1) / 12
      const span0 = stacked ? 4 : 13 - (parseInt(view.getComputedStyle(el).gridColumnStart) || 9)
      let steps = 0
      const onMove = (m: PointerEvent) => {
        let dx = m.clientX - x0
        let dy = m.clientY - y0
        if (!moved && Math.hypot(dx, dy) < pagePixels(3)) return
        moved = true
        frame.setAttribute('data-moving', '')
        if (cover) {
          // The cover sits at the right of the page and grows to the left, so its handle is on its left edge.
          const span = Math.max(3, Math.min(6, span0 + Math.round((stacked ? dx : -dx) / column)))
          steps = span - span0
          if (!stacked) el.style.gridColumn = `${13 - span} / span ${span}`
          el.style.maxWidth = stacked ? `${[12, 15.625, 19, 22][span - 3]}rem` : `${COVER_VW[span]}vw`
          place(frame, el)
          tag.textContent = `Cover: ${['Small', 'Standard', 'Large', 'Extra large'][span - 3]}`
          return
        }
        if (resizing) {
          width = Math.max(20, Math.min(100, Math.round(((startWidth + dx) / space) * 20) * 5))
          el.style.width = `${width}%`
          el.style.maxWidth = 'none'
          place(frame, el)
          tag.textContent = `Width ${width}%`
          return
        }
        // Snap only along a direction you are actually moving in, so a sideways drag never shifts it up or down.
        const s = snapOn() && !m.altKey ? snap(shift(start, dx, dy), lines, pagePixels(6)) : snap(start, { across: [], down: [] }, 0)
        if (Math.abs(dx) < pagePixels(3)) { s.dx = 0; s.hitAcross = undefined }
        if (Math.abs(dy) < pagePixels(3)) { s.dy = 0; s.hitDown = undefined }
        dx += s.dx
        dy += s.dy
        el.style.translate = `${dx}px ${dy}px`
        place(frame, el)
        drawGuides(doc, s)
        tag.textContent = `${movedText(left + dx, top + dy)}${s.hitAcross || s.hitDown ? ' · lined up' : ''}`
        last = { dx, dy, s }
      }
      const onUp = () => {
        frame.removeEventListener('pointermove', onMove)
        frame.removeEventListener('pointerup', onUp)
        frame.removeEventListener('pointercancel', onUp)
        frame.removeAttribute('data-moving')
        el.style.translate = ''
        el.style.width = ''
        el.style.maxWidth = ''
        el.style.gridColumn = ''
        tag.textContent = name
        clearGuides(doc)
        if (!moved) return
        if (cover) {
          if (steps) coverListeners.forEach((fn) => fn(steps))
        } else if (resizing) {
          widthListeners.forEach((fn) => fn(width))
          announceListeners.forEach((fn) => fn(`Width ${width}%.`))
        } else if (last.dx || last.dy) commit(left + last.dx, top + last.dy, describeSnap(last.s) || `Moved: ${movedText(left + last.dx, top + last.dy)}.`)
      }
      frame.addEventListener('pointermove', onMove)
      frame.addEventListener('pointerup', onUp)
      frame.addEventListener('pointercancel', onUp)
    }
    // The round handle above an image turns it around its centre. It settles on level (0°) when
    // close, and Shift keeps it to steps of 15°. Nothing is saved until the handle is let go.
    const rotate = (e: PointerEvent, frame: HTMLElement, el: HTMLElement) => {
      e.preventDefault()
      e.stopPropagation()
      frame.setPointerCapture(e.pointerId)
      const tag = tagOf(frame)
      const name = tag.textContent ?? ''
      const box = el.getBoundingClientRect()
      const [cx, cy] = [box.left + box.width / 2, box.top + box.height / 2]
      const pointer = (m: PointerEvent) => (Math.atan2(m.clientY - cy, m.clientX - cx) * 180) / Math.PI
      const start = angleOf(el)
      const p0 = pointer(e)
      let angle = start
      let moved = false
      const onMove = (m: PointerEvent) => {
        let a = start + pointer(m) - p0
        a = ((a + 540) % 360) - 180
        a = m.shiftKey ? Math.round(a / 15) * 15 : Math.round(a * 2) / 2
        if (!m.shiftKey && Math.abs(a) <= 1) a = 0
        if (!moved && a === start) return
        moved = true
        angle = a
        frame.setAttribute('data-moving', '')
        previewAngle(el, a)
        place(frame, el)
        tag.textContent = `Angle ${formatAngle(a)}${a === 0 ? ' · level' : ''}`
      }
      const onUp = () => {
        frame.removeEventListener('pointermove', onMove)
        frame.removeEventListener('pointerup', onUp)
        frame.removeEventListener('pointercancel', onUp)
        frame.removeAttribute('data-moving')
        tag.textContent = name
        previewAngle(el, null)
        place(frame, el)
        if (!moved || angle === start) return
        rotateListeners.forEach((fn) => fn(angle))
        announceListeners.forEach((fn) => fn(`Angle ${formatAngle(angle)}.`))
      }
      frame.addEventListener('pointermove', onMove)
      frame.addEventListener('pointerup', onUp)
      frame.addEventListener('pointercancel', onUp)
    }

    // Dragging any member of a group moves them all; guides follow the selected one.
    const dragGroup = (e: PointerEvent, frame: HTMLElement, lead: HTMLElement) => {
      const parts = movable()
      if (!parts.length) return
      e.preventDefault()
      e.stopPropagation()
      frame.setPointerCapture(e.pointerId)
      const [x0, y0] = [e.clientX, e.clientY]
      const starts = parts.map(({ el: n }) => offsetOf(n))
      const start = boxOf(lead)
      const lines = linesFor(lead, nameOf)
      let moved = false
      let last = { dx: 0, dy: 0 }
      const frames = () => [doc.querySelector<HTMLElement>('.el-frame'), ...doc.querySelectorAll<HTMLElement>('.el-gframe')].filter(Boolean) as HTMLElement[]
      const onMove = (m: PointerEvent) => {
        let dx = m.clientX - x0
        let dy = m.clientY - y0
        if (!moved && Math.hypot(dx, dy) < pagePixels(3)) return
        moved = true
        frames().forEach((f) => f.setAttribute('data-moving', ''))
        const s = snapOn() && !m.altKey ? snap(shift(start, dx, dy), lines, pagePixels(6)) : snap(start, { across: [], down: [] }, 0)
        if (Math.abs(dx) < pagePixels(3)) { s.dx = 0; s.hitAcross = undefined }
        if (Math.abs(dy) < pagePixels(3)) { s.dy = 0; s.hitDown = undefined }
        dx += s.dx
        dy += s.dy
        parts.forEach(({ el: n }) => { n.style.translate = `${dx}px ${dy}px` })
        placeFrames()
        drawGuides(doc, s)
        last = { dx, dy }
      }
      const onUp = () => {
        frame.removeEventListener('pointermove', onMove)
        frame.removeEventListener('pointerup', onUp)
        frame.removeEventListener('pointercancel', onUp)
        frames().forEach((f) => f.removeAttribute('data-moving'))
        parts.forEach(({ el: n }) => { n.style.translate = '' })
        clearGuides(doc)
        dragged = moved
        if (moved && (last.dx || last.dy)) commitGroup(parts.map(({ m }, i) => ({ ...m, left: starts[i][0] + last.dx, top: starts[i][1] + last.dy })), `Moved ${parts.length} parts together: ${movedText(last.dx, last.dy)}.`)
      }
      frame.addEventListener('pointermove', onMove)
      frame.addEventListener('pointerup', onUp)
      frame.addEventListener('pointercancel', onUp)
    }
    // Every group member other than the selected one has a lighter frame of its own.
    const placeFrames = () => {
      const lead = selectedEl()
      const frame = doc.querySelector<HTMLElement>('.el-frame')
      if (frame && lead) place(frame, lead)
      doc.querySelectorAll<HTMLElement>('.el-gframe').forEach((g) => {
        const n = elOf({ key: g.dataset.key!, blockId: g.dataset.block! })
        if (n) place(g, n); else hide(g)
      })
    }

    const onFrameDoubleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest?.('.el-frame') || grouped()) return
      const el = selectedEl()
      if (el) { e.preventDefault(); e.stopPropagation(); startTyping(el) }
    }

    // Keep the frame on the selected element as the page reflows, zooms or redraws.
    let raf = 0
    const sync = () => {
      html.style.setProperty('--ui', `${1 / scale()}px`)
      const el = selectedEl()
      const frame = doc.querySelector<HTMLElement>('.el-frame')
      if (frame) {
        if (el && !el.hasAttribute('data-el-editing')) { if (!frame.hasAttribute('data-moving')) place(frame, el) } else hide(frame)
      }
      doc.querySelectorAll<HTMLElement>('.el-gframe:not([data-moving])').forEach((g) => {
        const n = elOf({ key: g.dataset.key!, blockId: g.dataset.block! })
        if (n) place(g, n); else hide(g)
      })
      raf = view.requestAnimationFrame(sync)
    }
    sync()

    doc.addEventListener('pointerdown', onFrameDown, true)
    doc.addEventListener('pointermove', onPointerMove, { passive: true })
    html.addEventListener('pointerleave', onPointerLeave)
    doc.addEventListener('click', onClick, true)
    doc.addEventListener('dblclick', onFrameDoubleClick, true)
    doc.addEventListener('dblclick', onDoubleClick, true)
    doc.addEventListener('keydown', onKeyDown)
    if (doc !== document) document.addEventListener('keydown', onKeyDown)
    return () => {
      view.cancelAnimationFrame(raf)
      doc.removeEventListener('pointerdown', onFrameDown, true)
      doc.removeEventListener('pointermove', onPointerMove)
      html.removeEventListener('pointerleave', onPointerLeave)
      doc.removeEventListener('click', onClick, true)
      doc.removeEventListener('dblclick', onFrameDoubleClick, true)
      doc.removeEventListener('dblclick', onDoubleClick, true)
      doc.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [doc, p, select, toggle])

  // Mark the selected element and give it a frame after the page redraws.
  useEffect(() => {
    if (!doc) return
    const el = selected && [...doc.querySelectorAll<HTMLElement>('[data-el]')].find((n) => n.dataset.el === selected.key && n.closest('[data-puck-component]')?.getAttribute('data-puck-component') === selected.blockId)
    doc.querySelectorAll('[data-el-selected]').forEach((n) => n !== el && n.removeAttribute('data-el-selected'))
    // Group members: a mark on each element and a lighter frame for each one but the selected.
    const blockOf = (n: Element) => n.closest('[data-puck-component]')?.getAttribute('data-puck-component')
    const members = group.length > 1 ? group : []
    const isMember = (n: HTMLElement) => members.some((m) => m.key === n.dataset.el && m.blockId === blockOf(n))
    doc.querySelectorAll<HTMLElement>('[data-el]').forEach((n) => n.toggleAttribute('data-el-group', isMember(n)))
    doc.querySelectorAll('.el-gframe').forEach((g) => g.remove())
    for (const m of members) {
      if (selected && m.key === selected.key && m.blockId === selected.blockId) continue
      const g = doc.createElement('div')
      g.className = 'el-gframe'
      g.setAttribute('aria-hidden', 'true')
      g.dataset.key = m.key
      g.dataset.block = m.blockId
      doc.body.append(g)
    }
    let frame = doc.querySelector<HTMLElement>('.el-frame')
    if (!el) { frame?.remove(); doc.documentElement.removeAttribute('data-el-active'); return }
    el.setAttribute('data-el-selected', '')
    doc.documentElement.setAttribute('data-el-active', '')
    if (!frame) {
      frame = doc.createElement('div')
      frame.className = 'el-frame'
      frame.setAttribute('aria-hidden', 'true')
      const tag = doc.createElement('span')
      tag.className = 'el-tag'
      frame.append(tag)
      doc.body.append(frame)
    }
    const isImage = IMAGES.test(el.dataset.el!) && !members.length
    frame.querySelector('.el-tag')!.textContent = members.length ? `${members.length} selected · drag to move together` : nameOf(el.dataset.el!)
    frame.toggleAttribute('data-shared', el.hasAttribute('data-shared'))
    frame.toggleAttribute('data-cover', !members.length && el.classList.contains('cs-open-visual') && doc.defaultView!.getComputedStyle(el.parentElement!).display === 'grid')
    frame.title = members.length ? 'Drag to move the group together. Shift-click a part to add or remove it.' : el.hasAttribute('data-shared') ? 'Double-click to change this name everywhere it appears.' : `${el.dataset.edit ? 'Double-click to edit the words. ' : ''}Drag to move${isImage ? '; drag the side handle to change its size, or the round handle above to turn it' : ''}. Hold Option to move freely.`
    let handle = frame.querySelector('.el-handle')
    if (isImage && !handle) { handle = doc.createElement('span'); handle.className = 'el-handle'; frame.append(handle) }
    if (!isImage) handle?.remove()
    let turn = frame.querySelector('.el-rotate')
    if (isImage && !turn) { turn = doc.createElement('span'); turn.className = 'el-rotate'; (turn as HTMLElement).title = 'Drag to turn. Hold Shift for steps of 15°.'; frame.append(turn) }
    if (!isImage) turn?.remove()
  })

  return anchor
}

