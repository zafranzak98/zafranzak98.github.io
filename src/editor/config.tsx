import { createUsePuck, type ComponentConfig, type Config, type Fields } from '@puckeditor/core'
import imageWidths from 'virtual:image-widths'
import type { Project } from '#/lib/site'
import * as caseBlocks from '#/layout/case-blocks'
import { COLOURS, SPACES, designProps, designWarnings, type Design } from '#/layout/design'
import { CellBlock, GridBlock, ImageBlock, SpacerBlock, TextBlock } from '#/layout/free-blocks'
import { CaseFrame } from '#/layout/render'
import { Editing, type Elements } from '#/layout/elements'
import { CategoryNames } from '#/components/category-index'
import { CATEGORY_FIELD, applyEdits, categoryEdits, useCanvasEditing, type Edits } from './elements'
import { ElementPanel } from './panel'
import { EmptyImage } from './photos'

// The design editor's building blocks: the website's own blocks (src/layout), plus the controls
// shown for each. Adding a block here makes it available in the editor for every page.

const none = { label: 'As designed', value: '' }
const colourOptions = [none, ...COLOURS.map((c) => ({ label: c, value: c }))]
const spaceOptions = [none, ...SPACES.map((s) => ({ label: s === '0' ? 'None' : `${s} rem`, value: s }))]
const shiftOptions = [0, -4, -2, -1, -0.5, 0.5, 1, 2, 4].map((v) => ({ label: v === 0 ? 'In place' : `${v > 0 ? '+' : ''}${v} rem`, value: v }))

// The Design panel every block has: colour, spacing, position, alignment, width, type size and
// where it shows. "As designed" keeps the block exactly as the site styles it.
const designField: Fields<{ design: Design }>['design'] = {
  type: 'object',
  label: 'Design',
  objectFields: {
    background: { type: 'select', label: 'Background', options: colourOptions },
    textColour: { type: 'select', label: 'Text colour', options: colourOptions },
    spaceAbove: { type: 'select', label: 'Space above', options: spaceOptions },
    spaceBelow: { type: 'select', label: 'Space below', options: spaceOptions },
    spaceAbovePhone: { type: 'select', label: 'Space above on phones', options: spaceOptions },
    spaceBelowPhone: { type: 'select', label: 'Space below on phones', options: spaceOptions },
    shiftX: { type: 'select', label: 'Move left or right (desktop)', options: shiftOptions },
    shiftY: { type: 'select', label: 'Move up or down (desktop)', options: shiftOptions },
    align: { type: 'radio', label: 'Alignment', options: [none, { label: 'Left', value: 'left' }, { label: 'Centre', value: 'center' }, { label: 'Right', value: 'right' }] },
    width: { type: 'select', label: 'Width', options: [none, { label: 'Full', value: 'full' }, { label: 'Wide', value: 'wide' }, { label: 'Text column', value: 'text' }, { label: 'Narrow', value: 'narrow' }] },
    textSize: { type: 'select', label: 'Text size', options: [none, { label: 'Smaller', value: 'smaller' }, { label: 'Larger', value: 'larger' }, { label: 'Largest', value: 'largest' }] },
    headingSize: { type: 'select', label: 'Heading size', options: [none, { label: 'Smaller', value: 'smaller' }, { label: 'Larger', value: 'larger' }, { label: 'Largest', value: 'largest' }] },
    show: { type: 'radio', label: 'Show on', options: [{ label: 'All screens', value: '' }, { label: 'Desktop only', value: 'desktop' }, { label: 'Phones only', value: 'phone' }] },
  },
}

// Shown on a block while editing only: a plain warning, never a blocked save.
function Warnings({ messages }: { messages: string[] }) {
  if (!messages.length) return null
  return <div className="editor-warning" role="note">{messages.map((m) => <p key={m}>{m}</p>)}</div>
}

// A block built from the site, with the Design panel and editing-only warnings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function block(label: string, Render: (props: any) => React.ReactNode, extra: Record<string, unknown> = {}): ComponentConfig {
  return {
    label,
    ...extra,
    fields: { ...((extra.fields as object) ?? {}), design: designField },
    render: ({ puck, ...props }) => {
      // While editing, a block may draw itself differently (an Image section with no photo yet).
      const editing = puck.isEditing && (extra.whileEditing as ((p: Record<string, unknown>) => React.ReactNode) | undefined)?.(props)
      return (
        <>
          {puck.isEditing && <Warnings messages={designWarnings(props.design as Design)} />}
          {editing || <Render {...props} />}
        </>
      )
    },
  } as ComponentConfig
}

// Settings for single elements inside a block, shown for the element clicked on the page.
const elementsField = (p: Project) => ({
  type: 'custom',
  label: 'Single elements',
  render: ({ value, onChange }: { value: Elements | undefined; onChange: (v: Elements) => void }) => <ElementPanel value={value} onChange={onChange} p={p} />,
})

const photos = Object.keys(imageWidths).sort()
const ratioOptions = [{ label: 'Its own shape', value: 'auto' }, { label: 'Square', value: '1/1' }, { label: 'Portrait 4:5', value: '4/5' }, { label: 'Portrait 3:4', value: '3/4' }, { label: 'Tall 9:16', value: '9/16' }, { label: 'Landscape 16:9', value: '16/9' }, { label: 'Wide 21:9', value: '21/9' }]
const SIZES = [['Small', 'small'], ['Medium', 'medium'], ['Large', 'large'], ['Extra large', 'xlarge']].map(([label, value]) => ({ label, value }))
const percent = (label: string) => ({ type: 'number' as const, label, min: 0, max: 100, step: 5 })

export function editorConfig(p: Project): Config {
  return {
    root: {
      fields: {},
      // The page itself: the same frame the website uses, so the canvas is the real page.
      render: ({ children, edits }: { children: React.ReactNode; edits?: Edits }) => <EditorFrame p={p} edits={edits ?? {}}>{children}</EditorFrame>,
    },
    categories: {
      page: { title: 'Sections of this project', components: ['CategoryNav', 'Opening', 'Facts', 'SectionNav', 'Gap', 'Overview', 'Research', 'Work', 'Outcomes', 'AlsoIn', 'PrevNext'] },
      free: { title: 'Your own blocks', components: ['Text', 'Image', 'Grid', 'Cell', 'Spacer'] },
    },
    components: {
      CategoryNav: block('Category list', caseBlocks.CategoryNav),
      Opening: block('Opening', caseBlocks.Opening, { fields: { elements: elementsField(p) } }),
      Facts: block('Facts', caseBlocks.Facts, { fields: { elements: elementsField(p) } }),
      SectionNav: block('Section bar', caseBlocks.SectionNav),
      Gap: block('Gap before sections', caseBlocks.Gap),
      Overview: block('Overview', caseBlocks.Overview, { fields: { elements: elementsField(p) } }),
      Research: block('Research & thinking', caseBlocks.Research, { fields: { elements: elementsField(p) } }),
      Work: block('The work', caseBlocks.Work, { fields: { elements: elementsField(p) } }),
      Outcomes: block('Outcomes', caseBlocks.Outcomes, { fields: { elements: elementsField(p) } }),
      AlsoIn: block('Also in this category', caseBlocks.AlsoIn, { fields: { elements: elementsField(p) } }),
      PrevNext: block('Previous and next', caseBlocks.PrevNext),
      Text: block('Text', TextBlock, {
        fields: {
          elements: elementsField(p),
          kicker: { type: 'text', label: 'Small label above' },
          heading: { type: 'text', label: 'Heading' },
          headingLevel: { type: 'radio', label: 'Heading level', options: [{ label: 'Section', value: 'h2' }, { label: 'Sub-section', value: 'h3' }] },
          text: { type: 'textarea', label: 'Text (*bold*, **highlight**)' },
          size: { type: 'select', label: 'Text style', options: [{ label: 'Body', value: 'body' }, { label: 'Lead', value: 'lead' }, { label: 'Statement', value: 'statement' }] },
        } as never,
        defaultProps: { heading: 'Heading', text: 'Write here.', headingLevel: 'h2', size: 'body' } as never,
      }),
      Image: block('Image', ImageBlock, {
        fields: {
          elements: elementsField(p),
          image: { type: 'select', label: 'Photo', options: [{ label: 'Choose a photo', value: '' }, ...photos.map((path) => ({ label: path.replace('/media/', ''), value: path }))] },
          alt: { type: 'text', label: 'Description (what the photo shows)' },
          caption: { type: 'text', label: 'Caption' },
          ratio: { type: 'select', label: 'Shape', options: ratioOptions },
          focusX: percent('Crop focus across (%)'),
          focusY: percent('Crop focus down (%)'),
        } as never,
        defaultProps: { image: '', ratio: 'auto', focusX: 50, focusY: 50 } as never,
        // No photo yet: an empty frame with "Choose a photo", only in the editor.
        whileEditing: (props: Record<string, unknown>) => (props.image ? null : <EmptyImage id={props.id as string} {...designProps(props.design as Design, 'free-block free-image')} />),
      }),
      Grid: block('Free grid', GridBlock, {
        fields: {
          gap: { type: 'select', label: 'Space between', options: [{ label: 'None', value: 'none' }, { label: 'Tight', value: 'tight' }, { label: 'Normal', value: 'normal' }, { label: 'Wide', value: 'wide' }] },
          align: { type: 'radio', label: 'Line up items', options: [{ label: 'Top', value: 'start' }, { label: 'Middle', value: 'center' }, { label: 'Bottom', value: 'end' }] },
          cells: { type: 'slot', allow: ['Cell'] },
        } as never,
        defaultProps: {
          gap: 'normal',
          align: 'start',
          cells: [
            { type: 'Cell', props: { start: 1, span: 6, content: [] } },
            { type: 'Cell', props: { start: 7, span: 6, content: [] } },
          ],
        } as never,
      }),
      Cell: block('Grid cell', CellBlock, {
        fields: {
          start: { type: 'number', label: 'Starts at column (1 to 12)', min: 1, max: 12 },
          span: { type: 'number', label: 'Columns wide (1 to 12)', min: 1, max: 12 },
          content: { type: 'slot', allow: ['Text', 'Image', 'Spacer', 'Grid'] },
        } as never,
        defaultProps: { start: 1, span: 6, content: [] } as never,
      }),
      Spacer: block('Spacer', SpacerBlock, {
        fields: {
          height: { type: 'select', label: 'Height', options: SIZES },
          heightPhone: { type: 'select', label: 'Height on phones', options: [{ label: 'Same', value: '' }, ...SIZES] },
        } as never,
        defaultProps: { height: 'medium' } as never,
      }),
    },
  }
}

// The real page frame inside the editor, kept up to date with the blocks being arranged.
const usePuck = createUsePuck()
function EditorFrame({ p, edits, children }: { p: Project; edits: Edits; children: React.ReactNode }) {
  const content = usePuck((s) => s.appState.data.content) as never
  const anchor = useCanvasEditing(p, edits)
  return (
    <Editing.Provider value={true}>
      <CategoryNames.Provider value={Object.fromEntries(categoryEdits(edits).map(([field, words]) => [field.match(CATEGORY_FIELD)![1], words]))}>
        <span ref={anchor} hidden />
        <CaseFrame p={applyEdits(p, edits)} content={content}>{children}</CaseFrame>
      </CategoryNames.Provider>
    </Editing.Provider>
  )
}

// Images placed in the editor need a description, as on the rest of the site.
export function layoutWarnings(content: { type: string; props: Record<string, unknown> }[]): string[] {
  const out: string[] = []
  const walk = (items: typeof content) => {
    for (const item of items) {
      if (item.type === 'Image' && item.props.image && !String(item.props.alt ?? '').trim()) out.push('An image has no description. Add what it shows, for people using screen readers.')
      for (const v of Object.values(item.props)) if (Array.isArray(v) && v.every((x) => x && typeof x === 'object' && 'type' in x)) walk(v as typeof content)
    }
  }
  walk(content)
  return [...new Set(out)]
}
