import type React from 'react'

// Photos are uploaded and placed in the website editor (Sveltia CMS), not here. What remains is the
// guard for an Image section with no photo, which only an old draft can still hold: it shows as a
// plain frame while editing, and publishing is refused until the section is removed.

type Item = { type: string; props: Record<string, unknown> & { id: string } }

// An Image section with no photo, while editing: a plain frame that says so. It is never published.
export function EmptyImage({ id, className, style }: { id: string; className?: string; style?: React.CSSProperties }) {
  return (
    <figure className={className} style={style}>
      <div className="editor-empty-image" data-section={id}>
        <svg viewBox="0 0 48 36" width="48" height="36" aria-hidden="true"><rect x="1" y="1" width="46" height="34" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="15" cy="12" r="4" fill="currentColor" /><path d="M4 32 18 19l8 8 6-5 12 10Z" fill="currentColor" /></svg>
        <span className="editor-empty-text">No photo. Remove this section before publishing.</span>
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
