import { createUsePuck } from '@puckeditor/core'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import imageWidths from 'virtual:image-widths'
import { imageProps, projects } from '#/lib/site'

// Choosing a photo for an Image section: a grid of the photos already in the website, grouped by
// project, then a short description for people using screen readers. Nothing is uploaded: every
// photo listed is already published, so choosing one only changes the page layout.

const usePuck = createUsePuck()

type Photo = { path: string; name: string }
type Group = { title: string; photos: Photo[] }

// "spread-galliano.jpg" -> "spread galliano": a readable name for screen readers.
const nameOf = (path: string) => decodeURIComponent(path.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim()

export function photoGroups(): Group[] {
  const groups = new Map<string, Photo[]>()
  for (const path of Object.keys(imageWidths).sort()) {
    const parts = path.split('/')
    const key = parts[2] === 'projects' ? parts[3] : parts[2]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ path, name: nameOf(path) })
  }
  const titleOf = (key: string) => projects.find((p) => p.slug === key)?.title ?? (key === 'about' ? 'About page' : key.replace(/-/g, ' '))
  // The project being edited comes first, the About page last, the rest in title order.
  const here = new URLSearchParams(location.search).get('project') ?? ''
  const rank = (key: string) => (key === here ? 0 : key === 'about' ? 2 : 1)
  return [...groups].sort(([a], [b]) => rank(a) - rank(b) || titleOf(a).localeCompare(titleOf(b))).map(([key, photos]) => ({ title: key === here ? `${titleOf(key)} (this project)` : titleOf(key), photos }))
}

// Any part of the editor (the empty frame on the page, the section bar, the publish check) opens
// the picker for one Image section by its id.
let open: (id: string) => void = () => {}
export const openPhotoPicker = (id: string) => open(id)

type Item = { type: string; props: Record<string, unknown> & { id: string } }

export function PhotoPicker() {
  const [id, setId] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string>('')
  const [alt, setAlt] = useState('')
  const [tried, setTried] = useState(false)
  const getSelectorForId = usePuck((s) => s.getSelectorForId)
  const getItemBySelector = usePuck((s) => s.getItemBySelector)
  const dispatch = usePuck((s) => s.dispatch)
  const back = useRef<HTMLElement | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const groups = useRef(photoGroups()).current

  useEffect(() => {
    open = (blockId) => {
      const at = getSelectorForId(blockId)
      const item = at ? (getItemBySelector(at) as Item | undefined) : undefined
      back.current = document.activeElement as HTMLElement | null
      setChosen(typeof item?.props.image === 'string' ? item.props.image : '')
      setAlt(typeof item?.props.alt === 'string' ? item.props.alt : '')
      setTried(false)
      setId(blockId)
    }
    return () => { open = () => {} }
  }, [getSelectorForId, getItemBySelector])

  useEffect(() => {
    if (!id) return
    // Focus the chosen photo, or the first one, when the picker opens.
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>('.ph-pick[aria-pressed="true"], .ph-pick')?.focus())
  }, [id])

  if (!id) return null
  const close = () => { setId(null); back.current?.focus?.() }
  const use = () => {
    setTried(true)
    if (!chosen || !alt.trim()) return
    const at = getSelectorForId(id)
    const item = at ? (getItemBySelector(at) as Item | undefined) : undefined
    if (!at || !item) { close(); return }
    // The photo is shown at its own shape (never cropped), as covers are.
    dispatch({ type: 'replace', destinationIndex: at.index, destinationZone: at.zone, data: { ...item, props: { ...item.props, image: chosen, alt: alt.trim(), ratio: 'auto' } } as never })
    close()
  }
  const missing = tried && !chosen ? 'Choose a photo first.' : tried && !alt.trim() ? 'Describe the photo in a few words.' : ''

  return createPortal(
    <div className="ph-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div
        ref={dialog}
        className="ph-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ph-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
          // Keep keyboard focus inside the picker while it is open.
          if (e.key === 'Tab') {
            const all = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea') ?? [])]
            const first = all[0]
            const last = all[all.length - 1]
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
          }
        }}
      >
        <div className="ph-head">
          <h2 id="ph-title">Choose a photo</h2>
          <button type="button" className="ph-close" aria-label="Close without changing" onClick={close}>✕</button>
        </div>
        <p className="ph-note">Photos already on your website, by project. To add a new photo, upload it in the website editor (/admin) first; it then appears here.</p>
        <div className="ph-groups">
          {groups.map((g) => (
            <section key={g.title} aria-labelledby={`ph-g-${g.title}`}>
              <h3 id={`ph-g-${g.title}`}>{g.title}</h3>
              <div className="ph-grid">
                {g.photos.map((photo) => (
                  <button key={photo.path} type="button" className="ph-pick" aria-pressed={chosen === photo.path} aria-label={`${photo.name}, ${g.title}`} onClick={() => setChosen(photo.path)}>
                    <img {...imageProps(photo.path, '140px')} alt="" loading="lazy" decoding="async" />
                    {chosen === photo.path && <span className="ph-tick" aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="ph-foot">
          <label className="ph-alt">
            <span>Describe the photo <small>(what it shows, for people using screen readers)</small></span>
            <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') use() }} placeholder="For example: Model in the campaign jacket on a Sheffield street" aria-invalid={tried && !alt.trim()} />
          </label>
          {missing && <p className="ph-missing" role="alert">{missing}</p>}
          <div className="ph-actions">
            <button type="button" onClick={close}>Cancel</button>
            <button type="button" className="editor-primary" onClick={use}>Use this photo</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// The empty Image section on the page while editing: a calm frame with one clear action. It is
// never published: the publish check refuses a page with an empty Image section.
export function EmptyImage({ id, className, style }: { id: string; className?: string; style?: React.CSSProperties }) {
  return (
    <figure className={className} style={style}>
      <div className="editor-empty-image" data-choose-photo={id}>
        <svg viewBox="0 0 48 36" width="48" height="36" aria-hidden="true"><rect x="1" y="1" width="46" height="34" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="15" cy="12" r="4" fill="currentColor" /><path d="M4 32 18 19l8 8 6-5 12 10Z" fill="currentColor" /></svg>
        <span className="editor-empty-text">No photo yet</span>
        <button type="button" className="editor-empty-btn" data-choose-photo={id} onClick={() => openPhotoPicker(id)}>Choose a photo</button>
      </div>
    </figure>
  )
}

// Image sections anywhere on the page (also inside columns) that have no photo.
export function emptyImages(content: Item[]): string[] {
  const out: string[] = []
  const walk = (items: Item[]) => {
    for (const item of items) {
      if (item.type === 'Image' && !item.props.image) out.push(item.props.id)
      for (const v of Object.values(item.props)) if (Array.isArray(v) && v.every((x) => x && typeof x === 'object' && 'type' in x)) walk(v as Item[])
    }
  }
  walk(content)
  return out
}
