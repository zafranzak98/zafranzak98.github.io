import type { CSSProperties, ComponentType, ReactNode } from 'react'
import { Media } from '#/components/media'
import { Rich } from '#/components/rich'
import { designProps, type Design } from './design'
import { useElement, type Elements } from './elements'
import { RenderItems, type Item } from './render'

// Blocks for your own content, placed anywhere on a page: text, an image, a grid that places
// blocks freely across twelve columns, and a spacer. They use the site's own type, spacing and
// image handling, so whatever you build matches the approved design.

// A slot holds the blocks placed inside another block. On the website it is the saved list of
// blocks; inside the design editor it is a drop area provided by the editor.
type Slot = Item[] | ComponentType<{ className?: string; style?: CSSProperties }>
function SlotContent({ slot, className, style }: { slot?: Slot; className?: string; style?: CSSProperties }) {
  if (!slot) return null
  if (typeof slot === 'function') { const Area = slot; return <Area className={className} style={style} /> }
  return <div className={className} style={style}><RenderItems items={slot} /></div>
}

export function TextBlock({ kicker, heading, headingLevel = 'h2', text, size = 'body', design, elements }: {
  kicker?: string; heading?: string; headingLevel?: 'h2' | 'h3'; text?: string; size?: 'body' | 'lead' | 'statement'; design?: Design; elements?: Elements
}) {
  const el = useElement(elements)
  const H = headingLevel
  const textClass = size === 'lead' ? 'lead' : size === 'statement' ? 'free-statement' : 'body-text'
  return (
    <div {...designProps(design, 'free-block free-text')}>
      {kicker && <span {...el('kicker', { className: 'lab', field: 'prop:kicker' })}>{kicker}</span>}
      {heading && <H {...el('heading', { className: 'c free-heading', field: 'prop:heading' })}>{heading}</H>}
      {text && <p {...el('text', { className: textClass, field: 'prop:text' })}><Rich text={text} highlight /></p>}
    </div>
  )
}

// The shapes an Image section's frame can take; 'auto' keeps the photo's own proportions.
export const ratioOptions = [{ label: 'Its own shape', value: 'auto' }, { label: 'Square', value: '1/1' }, { label: 'Portrait 4:5', value: '4/5' }, { label: 'Portrait 3:4', value: '3/4' }, { label: 'Tall 9:16', value: '9/16' }, { label: 'Landscape 16:9', value: '16/9' }, { label: 'Wide 21:9', value: '21/9' }]

export function ImageBlock({ image, alt, caption, ratio = 'auto', fit = 'cover', focusX = 50, focusY = 50, design, elements }: {
  image?: string; alt?: string; caption?: string; ratio?: string; fit?: 'cover' | 'contain'; focusX?: number; focusY?: number; design?: Design; elements?: Elements
}) {
  const el = useElement(elements)
  // Showing the whole photo only means something in a frame of a fixed shape.
  const contain = fit === 'contain' && ratio !== 'auto'
  return (
    <figure {...designProps(design, contain ? 'free-block free-image free-fit-contain' : 'free-block free-image')}>
      <div {...el('photo', { className: 'free-photo' })}>
        <Media img={{ image, alt }} ratio={ratio} focus={`${focusX}% ${focusY}%`} label={alt || 'image'} sizes="(max-width: 899px) 100vw, 75vw" />
      </div>
      {caption && <figcaption {...el('caption', { className: 'cap', field: 'prop:caption' })}><Rich text={caption} /></figcaption>}
    </figure>
  )
}

// A twelve-column grid. Each cell says where it starts and how many columns it spans, so blocks
// can be placed freely side by side or offset. On phones the cells stack in order.
export function GridBlock({ gap = 'normal', align = 'start', cells, design }: {
  gap?: 'none' | 'tight' | 'normal' | 'wide'; align?: 'start' | 'center' | 'end'; cells?: Slot; design?: Design
}) {
  const { className, style } = designProps(design, `free-block free-grid free-gap-${gap} free-items-${align}`)
  return <SlotContent slot={cells} className={className} style={style} />
}

export function CellBlock({ start = 1, span = 6, content, design }: { start?: number; span?: number; content?: Slot; design?: Design }) {
  const { className, style } = designProps(design, 'free-cell', { '--start': start, '--span': span } as CSSProperties)
  return <SlotContent slot={content} className={className} style={style} />
}

const SPACER: Record<string, string> = { small: '1rem', medium: '2.5rem', large: '5.5rem', xlarge: '9rem' }
export function SpacerBlock({ height = 'medium', heightPhone, design }: { height?: string; heightPhone?: string; design?: Design }) {
  return <div aria-hidden="true" {...designProps(design, 'free-spacer', { '--h': SPACER[height] ?? SPACER.medium, '--h-m': SPACER[heightPhone ?? height] ?? SPACER.medium } as CSSProperties)} />
}

export const freeBlocks: Record<string, (props: Record<string, unknown>) => ReactNode> = {
  Text: TextBlock as never,
  Image: ImageBlock as never,
  Grid: GridBlock as never,
  Cell: CellBlock as never,
  Spacer: SpacerBlock as never,
}
