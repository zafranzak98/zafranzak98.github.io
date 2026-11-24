import { createUsePuck } from '@puckeditor/core'
import { useContext, useEffect, useRef, useState } from 'react'
import { Selection, nameOf, partsOf, type Picked } from './elements'
import { CopyIcon, DownIcon, TrashIcon, UpIcon } from './icons'

// The Sections panel on the left: one place for the page's sections, with two clear jobs.
// "On this page" lists the sections in the order visitors see them, to find, select and reorder
// them. "Add a section" offers what can be added, in plain words with a small picture of each.
// Both work on the same page data as the rest of the editor, so Undo covers everything here.

const usePuck = createUsePuck()
const canvas = () => (document.getElementById('preview-frame') as HTMLIFrameElement | null)?.contentDocument ?? null

type Item = { type: string; props: Record<string, unknown> & { id: string; design?: { show?: string; width?: string } } }
type Kind = { name: string; hint: string }

// What each kind of section is called here, and what it is, in a few words.
const KINDS: Record<string, Kind> = {
  CategoryNav: { name: 'Category links', hint: 'The list of categories at the top' },
  Opening: { name: 'Opening', hint: 'Title, introduction and cover' },
  Facts: { name: 'Facts', hint: 'Role, type, dates, deliverables, tools' },
  SectionNav: { name: 'Section links', hint: 'Jumps to Overview, Research, The work, Outcomes' },
  Gap: { name: 'Space before sections', hint: 'The gap above Overview' },
  Overview: { name: 'Overview', hint: 'What the project was' },
  Research: { name: 'Research & thinking', hint: 'How the idea developed' },
  Work: { name: 'The work', hint: 'The main images of the project' },
  Outcomes: { name: 'Outcomes', hint: 'Results and what was learned' },
  AlsoIn: { name: 'Also in this category', hint: 'Links to related projects' },
  PrevNext: { name: 'Previous and next', hint: 'Links to the neighbouring projects' },
  Text: { name: 'Text', hint: 'Your heading and paragraph' },
  Image: { name: 'Image', hint: 'Your image' },
  Grid: { name: 'Side by side', hint: 'Your columns' },
  Spacer: { name: 'Space', hint: 'Extra room' },
}
// The kind's short name, used wherever a section is named (the contextual bar, Undo, this panel).
export const kindName = (type: string) => KINDS[type]?.name ?? (type === 'Cell' ? 'Column' : type)
const STANDARD = ['CategoryNav', 'Opening', 'Facts', 'SectionNav', 'Gap', 'Overview', 'Research', 'Work', 'Outcomes', 'AlsoIn', 'PrevNext']

// A section's name in the list: your own text sections use their heading, so two are easy to tell apart.
export function sectionLabel(item: Item) {
  const kind = KINDS[item.type]?.name ?? item.type
  const heading = typeof item.props.heading === 'string' ? item.props.heading.trim() : ''
  if (item.type === 'Text' && heading) return `${item.props.size === 'statement' ? 'Statement' : 'Text'}: ${heading}`
  if (item.type === 'Text' && item.props.size === 'statement') return 'Statement'
  if (item.type === 'Image' && typeof item.props.caption === 'string' && item.props.caption) return `Image: ${item.props.caption}`
  return kind
}
const SHOW: Record<string, string> = { desktop: 'Desktop only', phone: 'Phones only' }

// Which tab is open, shared so other parts of the editor can open the panel at the right place.
let openTab: (tab: Tab) => void = () => {}
type Tab = 'page' | 'add'
export const openSections = (tab: Tab = 'page') => openTab(tab)
// Opens Sections at a section's parts (from the side panel), with the first part focused.
let openParts: (id: string) => void = () => {}
export const showPartsOf = (id: string) => { openTab('page'); setTimeout(() => openParts(id), 0) }

let nextId = 0
const newId = (type: string) => `${type}-${Date.now().toString(36)}${(nextId++).toString(36)}`

// What can be added. Each option is built from the site's own blocks; nothing here is a new
// kind of block. Text starts ready to type into. Photos are not added here: they are uploaded and
// placed in the website editor (Sveltia CMS), and adjusted here once they are on the page.
type Option = { id: string; name: string; text: string; picture: React.ReactNode; make: () => Item }
const text = (props: Record<string, unknown> = {}): Item => ({ type: 'Text', props: { id: newId('Text'), heading: 'Heading', text: 'Write here.', headingLevel: 'h2', size: 'body', ...props } })

const P = { olive: '#484527', sage: '#A3B18A', light: '#CDD5BE', off: '#EEF1ED' }
const Pic = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true" className="sec-pic"><rect width="64" height="40" rx="3" fill={P.off} />{children}</svg>
)
const lines = (x: number, y: number, w: number, n: number) => Array.from({ length: n }, (_, i) => <rect key={i} x={x} y={y + i * 5} width={i === n - 1 ? w * 0.6 : w} height="2" rx="1" fill={P.olive} opacity="0.45" />)

const GROUPS: { title: string; options: Option[] }[] = [
  {
    title: 'Words',
    options: [
      { id: 'text', name: 'Text', text: 'A heading and a paragraph.', make: () => text(), picture: <Pic><rect x="8" y="8" width="26" height="4" rx="1" fill={P.olive} />{lines(8, 17, 48, 3)}</Pic> },
      { id: 'statement', name: 'Statement', text: 'One short message in large type, for a key point or a quotation.', make: () => text({ heading: '', text: 'Your statement.', size: 'statement' }), picture: <Pic><rect x="8" y="12" width="48" height="6" rx="1.5" fill={P.olive} /><rect x="8" y="22" width="30" height="6" rx="1.5" fill={P.olive} /></Pic> },
    ],
  },
  {
    title: 'Spacing',
    options: [
      { id: 'space', name: 'Space', text: 'Extra room between two sections.', make: () => ({ type: 'Spacer', props: { id: newId('Spacer'), height: 'medium' } }), picture: <Pic><rect x="8" y="6" width="48" height="6" rx="1" fill={P.light} /><path d="M32 15v10M28 18l4-4 4 4M28 22l4 4 4-4" stroke={P.olive} strokeWidth="1.4" fill="none" /><rect x="8" y="28" width="48" height="6" rx="1" fill={P.light} /></Pic> },
    ],
  },
]

export function SectionsPanel() {
  const [tab, setTab] = useState<Tab>('page')
  const [said, setSaid] = useState('')
  useEffect(() => { openTab = setTab; return () => { openTab = () => {} } }, [])
  useEffect(() => { if (!said) return; const t = setTimeout(() => setSaid(''), 6000); return () => clearTimeout(t) }, [said])
  return (
    <div className="sec-panel">
      <div className="sec-tabs" role="tablist" aria-label="Sections">
        <button type="button" role="tab" id="sec-tab-page" aria-controls="sec-pane" aria-selected={tab === 'page'} onClick={() => setTab('page')}>On this page</button>
        <button type="button" role="tab" id="sec-tab-add" aria-controls="sec-pane" aria-selected={tab === 'add'} onClick={() => setTab('add')}>Add a section</button>
      </div>
      <div id="sec-pane" role="tabpanel" aria-labelledby={tab === 'page' ? 'sec-tab-page' : 'sec-tab-add'}>
        {tab === 'page' ? <OnThisPage onAdd={() => setTab('add')} announce={setSaid} /> : <AddSection onAdded={() => setTab('page')} announce={setSaid} />}
      </div>
      {said && <p className="sec-said">{said}</p>}
      <span className="sr-only" role="status" aria-live="polite">{said}</span>
    </div>
  )
}

// Selects a section and brings it into view on the page.
function useGoTo() {
  const dispatch = usePuck((s) => s.dispatch)
  const getSelectorForId = usePuck((s) => s.getSelectorForId)
  const { select } = useContext(Selection)
  return (id: string) => {
    const at = getSelectorForId(id)
    if (!at) return
    select(null)
    dispatch({ type: 'setUi', ui: { itemSelector: at } })
    // The page redraws after the selection changes; scroll once it has.
    setTimeout(() => canvas()?.querySelector(`[data-puck-component="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
  }
}

function OnThisPage({ onAdd, announce: setSaid }: { onAdd: () => void; announce: (s: string) => void }) {
  const content = usePuck((s) => s.appState.data.content) as unknown as Item[]
  const selectedId = usePuck((s) => (s.selectedItem?.props as { id?: string } | undefined)?.id)
  const getSelectorForId = usePuck((s) => s.getSelectorForId)
  const dispatch = usePuck((s) => s.dispatch)
  const goTo = useGoTo()
  const [menu, setMenu] = useState<string | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const list = useRef<HTMLOListElement>(null)
  // Each section's parts, listed under its row when opened: another way to select a part, the same
  // as clicking it on the page, that works by keyboard and touch.
  const { selected: part, select } = useContext(Selection)
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [parts, setParts] = useState<Record<string, Picked[]>>({})
  const toggle = (id: string, to = !open.has(id)) => setOpen((now) => { const next = new Set(now); if (to) next.add(id); else next.delete(id); return next })
  // Read the parts from the page once it has redrawn (after any change to the content).
  useEffect(() => {
    const t = setTimeout(() => setParts(Object.fromEntries(content.map((i) => [i.props.id, partsOf(i.props.id)]))), 80)
    return () => clearTimeout(t)
  }, [content, open])
  useEffect(() => {
    openParts = (id) => { toggle(id, true); setTimeout(() => list.current?.querySelector<HTMLButtonElement>(`[data-parts-of="${id}"] button`)?.focus(), 150) }
    return () => { openParts = () => {} }
  })
  // A part selected on the page opens its section here, so the list shows where it is.
  const partTop = part ? content.find((i) => i.props.id === part.blockId || JSON.stringify(i.props).includes(`"id":"${part.blockId}"`))?.props.id : undefined
  useEffect(() => { if (partTop && !open.has(partTop)) toggle(partTop, true) }, [partTop])
  const pick = (m: Picked) => {
    // Select the block the part belongs to, then the part itself, as a click on the page does.
    const at = getSelectorForId(m.blockId)
    if (at) dispatch({ type: 'setUi', ui: { itemSelector: at } })
    setTimeout(() => select(m), 0)
    setTimeout(() => canvas()?.querySelector(`[data-puck-component="${m.blockId}"] [data-el="${m.key}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60)
  }
  // The section selected on the page may be inside another one (a column of a grid): show its section.
  const selectedTop = content.find((i) => i.props.id === selectedId || JSON.stringify(i.props).includes(`"id":"${selectedId}"`))?.props.id

  const move = (from: number, to: number, focus = false) => {
    if (to < 0 || to >= content.length || from === to) return
    const at = getSelectorForId(content[from].props.id)
    if (!at) return
    dispatch({ type: 'reorder', sourceIndex: from, destinationIndex: to, destinationZone: at.zone })
    const name = sectionLabel(content[from])
    setSaid(`${name} moved to position ${to + 1} of ${content.length}.`)
    if (focus) setTimeout(() => list.current?.querySelectorAll<HTMLButtonElement>('.sec-go')[to]?.focus(), 30)
  }
  const setShow = (i: number, show: string) => {
    const item = content[i]
    const at = getSelectorForId(item.props.id)
    if (!at) return
    const design = { ...(item.props.design ?? {}) }
    if (show) design.show = show
    else delete design.show
    dispatch({ type: 'replace', destinationIndex: at.index, destinationZone: at.zone, data: { ...item, props: { ...item.props, design } } as never })
    setSaid(`${sectionLabel(item)}: ${show ? SHOW[show] : 'shown on all screens'}.`)
  }
  const duplicate = (i: number) => {
    const at = getSelectorForId(content[i].props.id)
    if (at) { dispatch({ type: 'duplicate', sourceIndex: at.index, sourceZone: at.zone }); setSaid(`${sectionLabel(content[i])} duplicated below itself.`) }
  }
  const remove = (i: number) => {
    const at = getSelectorForId(content[i].props.id)
    if (at) { dispatch({ type: 'remove', index: at.index, zone: at.zone }); setSaid(`${sectionLabel(content[i])} removed. Undo brings it back.`) }
  }

  useEffect(() => {
    if (!menu) return
    const away = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.sec-menu, .sec-more')) setMenu(null) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [menu])

  return (
    <div className="sec-page">
      <p className="sec-intro">Your page from top to bottom, as visitors see it. Choose a section to go to it. Drag <span aria-hidden="true">⠿</span> to reorder, or use ⋯.</p>
      <ol className="sec-list" ref={list} onDragOver={(e) => e.preventDefault()}>
        {content.map((item, i) => {
          const kind = KINDS[item.type]
          const show = item.props.design?.show
          const selected = selectedTop === item.props.id
          const label = sectionLabel(item)
          return (
            <li
              key={item.props.id}
              className={`sec-row${selected ? ' is-selected' : ''}${dragging === i ? ' is-dragging' : ''}${over === i && dragging !== null && dragging !== i ? (dragging < i ? ' drop-after' : ' drop-before') : ''}`}
              onDragOver={(e) => { e.preventDefault(); if (dragging !== null) setOver(i) }}
              onDrop={(e) => { e.preventDefault(); if (dragging !== null) move(dragging, i); setDragging(null); setOver(null) }}
              onKeyDown={(e) => { if (e.key === 'Escape' && menu === item.props.id) { e.preventDefault(); e.stopPropagation(); setMenu(null); e.currentTarget.querySelector<HTMLButtonElement>('.sec-more')?.focus() } }}
            >
              <span
                className="sec-grip"
                draggable
                title="Drag to move this section"
                aria-hidden="true"
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.props.id); setDragging(i) }}
                onDragEnd={() => { setDragging(null); setOver(null) }}
              >⠿</span>
              {(parts[item.props.id]?.length ?? 0) > 0 ? (
                <button
                  type="button"
                  className="sec-toggle"
                  aria-expanded={open.has(item.props.id)}
                  aria-controls={`sec-parts-${item.props.id}`}
                  aria-label={`Parts of ${label}`}
                  title={open.has(item.props.id) ? 'Hide its parts' : 'Show its parts'}
                  onClick={() => toggle(item.props.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight') { e.preventDefault(); if (open.has(item.props.id)) e.currentTarget.parentElement?.querySelector<HTMLButtonElement>('.sec-parts button')?.focus(); else toggle(item.props.id, true) }
                    if (e.key === 'ArrowLeft') { e.preventDefault(); toggle(item.props.id, false) }
                  }}
                ><span aria-hidden="true">▸</span></button>
              ) : <span className="sec-toggle-none" aria-hidden="true" />}
              <button
                type="button"
                className="sec-go"
                aria-current={selected ? 'true' : undefined}
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                aria-description="Alt and an arrow key move it up or down."
                onClick={() => goTo(item.props.id)}
                onKeyDown={(e) => {
                  if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); move(i, i - 1, true) }
                  if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1, true) }
                }}
              >
                <span className="sec-num" aria-hidden="true">{i + 1}</span>
                <span className="sec-text">
                  <span className="sec-name">{label}</span>
                  <span className="sec-hint">{kind?.hint ?? ''}{show ? <span className="sec-badge"> · {SHOW[show]}</span> : null}</span>
                </span>
              </button>
              <button type="button" className="sec-more" aria-label={`More for ${label}`} aria-haspopup="true" aria-expanded={menu === item.props.id} onClick={() => setMenu(menu === item.props.id ? null : item.props.id)}>⋯</button>
              {menu === item.props.id && (
                <div className="sec-menu" role="group" aria-label={`${label}: actions`} ref={(m) => {
                  if (!m) return
                  // Opens upwards near the bottom of the window, so every action stays reachable.
                  if (!m.dataset.placed) { m.dataset.placed = '1'; if (m.getBoundingClientRect().bottom > window.innerHeight - 90) m.classList.add('is-up') }
                  if (!m.contains(document.activeElement)) m.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
                }}>
                  <button type="button" disabled={i === 0} onClick={() => { move(i, i - 1); setMenu(null) }}><UpIcon /> Move up</button>
                  <button type="button" disabled={i === content.length - 1} onClick={() => { move(i, i + 1); setMenu(null) }}><DownIcon /> Move down</button>
                  <button type="button" onClick={() => { duplicate(i); setMenu(null) }}><CopyIcon /> Duplicate</button>
                  <span className="sec-menu-label">Show on</span>
                  {([['', 'All screens'], ['desktop', 'Desktop only'], ['phone', 'Phones only']] as const).map(([v, l]) => (
                    <button key={v} type="button" aria-pressed={(show ?? '') === v} className="sec-check" onClick={() => { setShow(i, v); setMenu(null) }}><span className="sec-tick" aria-hidden="true">{(show ?? '') === v ? '✓' : ''}</span>{l}</button>
                  ))}
                  <button type="button" className="sec-danger" onClick={() => { remove(i); setMenu(null) }}><TrashIcon /> Remove</button>
                </div>
              )}
              {open.has(item.props.id) && (parts[item.props.id]?.length ?? 0) > 0 && (
                <ul className="sec-parts" id={`sec-parts-${item.props.id}`} data-parts-of={item.props.id} aria-label={`Parts of ${label}`}>
                  {(() => {
                    const list = parts[item.props.id]
                    const count: Record<string, number> = {}
                    return list.map((m) => {
                      const base = nameOf(m.key)
                      const n = (count[base] = (count[base] ?? 0) + 1)
                      const name = list.filter((x) => nameOf(x.key) === base).length > 1 ? `${base} ${n}` : base
                      const current = !!part && part.key === m.key && part.blockId === m.blockId
                      return (
                        <li key={`${m.blockId}|${m.key}`}>
                          <button type="button" aria-current={current ? 'true' : undefined} onClick={() => pick(m)}
                            onKeyDown={(e) => {
                              const items = [...(e.currentTarget.closest('ul')?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
                              const at = items.indexOf(e.currentTarget)
                              if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(items.length - 1, at + 1)]?.focus() }
                              if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(0, at - 1)]?.focus() }
                              if (e.key === 'ArrowLeft') { e.preventDefault(); e.currentTarget.closest('.sec-row')?.querySelector<HTMLButtonElement>('.sec-toggle')?.focus() }
                            }}>{name}</button>
                        </li>
                      )
                    })
                  })()}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
      <button type="button" className="sec-add-link" onClick={onAdd}>+ Add a section</button>
    </div>
  )
}

function AddSection({ onAdded, announce }: { onAdded: () => void; announce: (s: string) => void }) {
  const content = usePuck((s) => s.appState.data.content) as unknown as Item[]
  const selectedId = usePuck((s) => (s.selectedItem?.props as { id?: string } | undefined)?.id)
  const dispatch = usePuck((s) => s.dispatch)
  const getSelectorForId = usePuck((s) => s.getSelectorForId)
  const { select } = useContext(Selection)
  // Where it goes: below the selected section, otherwise above "Also in this category" (the end of
  // the project's own story), otherwise at the end.
  const selectedTop = content.findIndex((i) => i.props.id === selectedId || JSON.stringify(i.props).includes(`"id":"${selectedId}"`))
  const storyEnd = content.findIndex((i) => i.type === 'AlsoIn' || i.type === 'PrevNext')
  const fallback = storyEnd > 0 ? storyEnd - 1 : content.length - 1
  const [after, setAfter] = useState(selectedTop >= 0 ? selectedTop : fallback)
  const at = Math.min(after, content.length - 1)
  const missing = STANDARD.filter((t) => !content.some((i) => i.type === t))

  const add = (item: Item, name: string) => {
    const index = at + 1
    dispatch({ type: 'setData', data: (prev: { content?: Item[] }) => { const next = [...(prev.content ?? [])]; next.splice(index, 0, item); return { content: next } }, recordHistory: true } as never)
    // Select the new section straight away (the root zone is the one every top-level section sits in).
    const zone = content[0] ? getSelectorForId(content[0].props.id)?.zone : undefined
    if (zone) { select(null); dispatch({ type: 'setUi', ui: { itemSelector: { index, zone } } }) }
    onAdded()
    setTimeout(() => canvas()?.querySelector(`[data-puck-component="${item.props.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120)
    const where = at >= 0 ? `below ${sectionLabel(content[at])}` : 'at the top'
    announce(`${name} added ${where}. Undo removes it.`)
  }

  return (
    <div className="sec-add">
      <label className="sec-where">
        <span>It goes below</span>
        <select value={at} onChange={(e) => setAfter(Number(e.target.value))}>
          <option value={-1}>(the very top)</option>
          {content.map((item, i) => <option key={item.props.id} value={i}>{i + 1}. {sectionLabel(item)}</option>)}
        </select>
      </label>
      {GROUPS.map((g) => (
        <section key={g.title} className="sec-group" aria-labelledby={`sec-g-${g.title}`}>
          <h3 id={`sec-g-${g.title}`}>{g.title}</h3>
          {g.options.map((o) => (
            <button key={o.id} type="button" className="sec-option" onClick={() => add(o.make(), o.name)}>
              {o.picture}
              <span className="sec-text"><span className="sec-name">{o.name}</span><span className="sec-hint">{o.text}</span></span>
            </button>
          ))}
        </section>
      ))}
      {missing.length > 0 && (
        <section className="sec-group" aria-labelledby="sec-g-back">
          <h3 id="sec-g-back">Put back a project section</h3>
          <p className="sec-intro">These were removed from this page.</p>
          {missing.map((t) => (
            <button key={t} type="button" className="sec-option sec-option-plain" onClick={() => add({ type: t, props: { id: newId(t) } }, KINDS[t].name)}>
              <span className="sec-text"><span className="sec-name">{KINDS[t].name}</span><span className="sec-hint">{KINDS[t].hint}</span></span>
            </button>
          ))}
        </section>
      )}
      <p className="sec-intro sec-after">After adding, double-click the words on the page to type, or use <b>All settings</b>. Photos are added in the website editor (/admin); once a photo is on the page, select it here to adjust it.</p>
    </div>
  )
}
