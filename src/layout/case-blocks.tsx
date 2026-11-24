import { PageLink } from '#/components/page-link'
import { Fragment, createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react'
import CategoryIndex from '#/components/category-index'
import Gallery from '#/components/gallery'
import { Media } from '#/components/media'
import OpeningVisual from '#/components/opening-visual'
import { Rich } from '#/components/rich'
import { caseStudies, categoryName, highlightOnSage, openingOf, yearOf, type Img, type Project } from '#/lib/site'
import { designProps, type Design } from './design'
import { useElement, type Elements } from './elements'
import { label } from './labels'

// The parts of a case study page, as blocks the design editor can arrange and restyle.
// Each one renders exactly the markup the page always had; design settings, when present,
// are added to its outer element.

// The four numbered sections. The optional third value is a shorter name for the phone bar.
export const SECTIONS: [string, string, string?][] = [
  ['overview', 'Overview'],
  ['research', 'Research & thinking', 'Research'],
  ['work', 'The work'],
  ['outcomes', 'Outcomes'],
]
export const SECTION_BLOCKS: Record<string, string> = { Overview: 'overview', Research: 'research', Work: 'work', Outcomes: 'outcomes' }

// A section with nothing in it is left out, so a project never shows empty headings.
export function isFilled(p: Project, id: string) {
  const r = p.research
  switch (id) {
    case 'overview': return Boolean(p.objective || p.what_i_did || p.what_team_did)
    case 'research': return Boolean(r?.stats?.length || r?.text || r?.extra || r?.moodboard)
    case 'work': return Boolean(p.key_piece || p.supporting?.length || p.supporting_note || p.context || p.film || p.gallery?.some((g) => g.image) || p.gallery_note)
    case 'outcomes': return Boolean(p.results?.length || p.outcome_note || p.skills?.length || p.link)
  }
  return false
}

// What every block on a case study page shares: the project, and the sections shown in the
// order the layout puts them (for numbering and the section bar).
type CaseContext = { p: Project; shown: string[]; active: string }
export const Case = createContext<CaseContext | null>(null)
const useCase = () => {
  const c = useContext(Case)
  if (!c) throw new Error('Case study blocks must be rendered inside a case study page.')
  return c
}

type BlockProps = { design?: Design; elements?: Elements }

// ---- Opening, facts and navigation

export function CategoryNav({ design }: BlockProps) {
  const { p } = useCase()
  return <div {...designProps(design, 'cs-index')}><CategoryIndex current={p.category} /></div>
}

export function Opening({ design, elements }: BlockProps) {
  const { p } = useCase()
  const el = useElement(elements)
  const o = openingOf(p)
  const idx = caseStudies.findIndex((x) => x.slug === p.slug)
  return (
    <section {...designProps(design, highlightOnSage(p) ? 'cs-open on-sage' : 'cs-open', { background: o.bg, color: o.fg })}>
      <div className="cs-open-grid">
        <div className="cs-open-text">
          <span {...el('sub', { className: 'cs-sub', style: { color: o.sub } })}>
            {categoryName(p.category)} · {yearOf(p)} · Project {idx + 1} of {caseStudies.length}
            {p.status === 'Draft' && <span className="draft-badge">Draft</span>}
          </span>
          <h1 {...el('title', { className: 'c cs-title', field: 'title' })}>{p.title}</h1>
          <p {...el('line', { className: 'cs-line', field: 'summary', rich: true })}><span><Rich text={p.summary} /></span></p>
        </div>
        <div {...el('image', { className: 'cs-open-visual' })}><OpeningVisual p={p} /></div>
      </div>
    </section>
  )
}

export function Facts({ design, elements }: BlockProps) {
  const { p } = useCase()
  const el = useElement(elements)
  const type = [p.project_type, p.type_detail].filter(Boolean).join(' · ')
  const facts = ([
    ['role', p.role],
    ['type', type],
    ['when', p.when],
    ['deliverables', p.deliverables?.join(', ')],
    ['tools', p.tools?.join(', ')],
  ] as const).filter(([, v]) => v)
  const fact = ([k, v]: (typeof facts)[number]) => (
    <div key={k}>
      <span {...el(`label-${k}`, { className: 'lab', field: `labels:${k}` })}>{label(p, k)}</span>
      <span {...el(`value-${k}`, { className: 'fact-val', field: k })}>{v}</span>
    </div>
  )
  return (
    <section {...designProps(design, 'facts')}>
      {facts.slice(0, 1).map(fact)}
      <div className="facts-rest">{facts.slice(1).map(fact)}</div>
    </section>
  )
}

export function SectionNav({ design }: BlockProps) {
  const { p, shown, active } = useCase()
  if (shown.length < 2) return null
  return (
    <nav aria-label="On this page" {...designProps(design, 'secnav c')}>
      {shown.map((id, i) => {
        const [, standard, standardShort] = SECTIONS.find(([s]) => s === id)!
        const t = label(p, id as 'overview')
        const short = t === standard ? standardShort : undefined
        return (
          <Fragment key={id}>
            {i > 0 && <span className="cat-index-sep" aria-hidden="true">/</span>}
            <a href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>
              {short ? <><span className="d-only">{t}</span><span className="m-only">{short}</span></> : t}
            </a>
          </Fragment>
        )
      })}
    </nav>
  )
}

export function Gap({ design }: BlockProps) {
  return <div {...designProps(design, 'cs-gap')} />
}

// ---- The four numbered sections

type SecProps = { id: string; title: string; children: ReactNode; wide?: boolean; design?: Design; titleProps?: Record<string, unknown> }
function Sec({ id, title, children, wide, design, titleProps = { className: 'c' } }: SecProps) {
  const { shown } = useCase()
  const n = String(shown.indexOf(id) + 1).padStart(2, '0')
  return (
    <section id={id} {...designProps(design, wide ? 'cs-sec cs-sec-wide' : 'cs-sec')}>
      <div className="cs-label"><span className="lab">{n}</span><h2 {...titleProps}>{title}</h2></div>
      <div className="cs-body">{children}</div>
    </section>
  )
}

type ElementFn = ReturnType<typeof useElement>
// Adds a wrapper only when an element needs one (in the editor, or once it has settings), so
// untouched pages keep their markup exactly.
const Wrap = ({ props, children }: { props: Record<string, unknown>; children: ReactNode }) => (Object.values(props).some((v) => v !== undefined) ? <div {...props}>{children}</div> : <>{children}</>)
const plain: ElementFn = (_key, { className, style } = {}) => ({ className, style })

const Figures = ({ items, big, el = plain, field }: { items: { figure: string; label: string }[]; big?: boolean; el?: ElementFn; field?: string }) => (
  <div className={big ? 'figures figures-big' : 'figures'}>
    {items.map((f, i) => (
      <div key={i}>
        <b {...el(`figure-${i}`, { className: 'c', style: { '--chars': Math.max(3, [...f.figure].length) } as CSSProperties, field: field && `${field}:${i}:figure` })}>{f.figure}</b>
        <span {...el(`figure-label-${i}`, { field: field && `${field}:${i}:label`, rich: true })}><Rich text={f.label} /></span>
      </div>
    ))}
  </div>
)

export function Overview({ design, elements }: BlockProps) {
  const { p, shown } = useCase()
  const el = useElement(elements)
  if (!shown.includes('overview')) return null
  return (
    <Sec id="overview" title={label(p, 'overview')} design={design} titleProps={el('title', { className: 'c', field: 'labels:overview' })}>
      {p.objective && <p {...el('lead', { className: 'lead', field: 'objective', rich: true })}><Rich text={p.objective} highlight /></p>}
      <div className={p.what_team_did ? 'did did-two' : 'did'}>
        {p.what_i_did && <div><span {...el('label-did', { className: 'lab', field: 'labels:what_i_did' })}>{label(p, 'what_i_did')}</span><p {...el('did', { field: 'what_i_did', rich: true })}><Rich text={p.what_i_did} highlight /></p></div>}
        {p.what_team_did && <div><span {...el('label-team', { className: 'lab', field: 'labels:what_team_did' })}>{label(p, 'what_team_did')}</span><p {...el('team', { field: 'what_team_did', rich: true })}><Rich text={p.what_team_did} highlight /></p></div>}
      </div>
    </Sec>
  )
}

export function Research({ design, elements }: BlockProps) {
  const { p, shown } = useCase()
  const el = useElement(elements)
  if (!shown.includes('research')) return null
  const r = p.research
  return (
    <Sec id="research" title={label(p, 'research')} design={design} titleProps={el('title', { className: 'c', field: 'labels:research' })}>
      {r?.stats?.length ? <Figures items={r.stats} el={el} field="research:stats" /> : null}
      {r?.text && <p {...el('text', { className: 'lead', field: 'research:text', rich: true })}><Rich text={r.text} /></p>}
      {r?.extra && <p {...el('extra', { className: 'body-text', field: 'research:extra', rich: true })}><Rich text={r.extra} /></p>}
      {r?.moodboard && <div {...el('moodboard', { className: 'mood' })}><Media img={r.moodboard} ratio="21/9" label="moodboard" sizes="(max-width: 899px) 100vw, 67vw" /></div>}
    </Sec>
  )
}

const caption = (img: Img | undefined, el: ElementFn, key: string, field: string) => img?.caption && <p {...el(key, { className: 'cap', field, rich: true })}><Rich text={img.caption} /></p>

// How wide supporting images are shown: one, two or three across (two across on a phone).
const GRID_SIZES: Record<number, string> = {
  1: '(max-width: 899px) 100vw, 30vw',
  2: '(max-width: 899px) 50vw, 45vw',
  3: '(max-width: 899px) 50vw, 30vw',
}

// The work: the same section on every project, laid out as approved for each one.
function WorkContent({ p, el }: { p: Project; el: ElementFn }) {
  const sup = p.supporting ?? []
  const grid = (framed = false) =>
    sup.length > 0 && (
      <div className={`work-grid cols-${sup.length}${framed ? ' work-grid-framed' : ''}`}>
        {sup.map((s, i) => (
          <figure key={i} {...el(`image-${i}`)}>
            <Media img={s} ratio="4/5" sizes={GRID_SIZES[sup.length] ?? GRID_SIZES[3]} />
            {caption(s, el, `caption-${i}`, `supporting:${i}:caption`)}
          </figure>
        ))}
      </div>
    )
  const key = p.key_piece && (
    <figure {...el('key', { className: 'work-key' })}>
      <Media img={p.key_piece} ratio="16/9" sizes="(max-width: 899px) 100vw, 90vw" />
      {caption(p.key_piece, el, 'key-caption', 'key_piece:caption')}
    </figure>
  )
  const note = p.supporting_note && <p {...el('note', { className: 'cap', field: 'supporting_note', rich: true })}><Rich text={p.supporting_note} /></p>
  switch (p.design) {
    case 'bersih':
      return (
        <>
          {key}
          {grid()}
          {p.context && (
            <div className="work-context">
              <Wrap props={el('context')}><Media img={p.context} ratio="9/16" sizes="(max-width: 899px) 33vw, 30vw" /></Wrap>
              <p {...el('context-text', { field: 'context:text', rich: true })}><Rich text={p.context.text} /></p>
            </div>
          )}
        </>
      )
    case 'evoke':
      return <>{key}{grid(true)}{note}</>
    default:
      return <>{key}{grid()}{note}<Film p={p} el={el} /></>
  }
}

// Accepts the link as copied from YouTube or Vimeo and returns the address their players embed.
function embedUrl(url: string) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
}

// YouTube and Vimeo films load only when the visitor presses play, so nothing is fetched from
// those sites before then. Once playing, the provider may collect information or store data.
function Film({ p, el }: { p: Project; el: ElementFn }) {
  const [playing, setPlaying] = useState(false)
  if (!p.film) return null
  const url = p.film.url
  const embed = url && embedUrl(url)
  const title = p.film.caption ?? `${p.title} film`
  return (
    <figure {...el('film', { className: 'film' })}>
      {url ? (
        embed ? (
          playing ? (
            <iframe src={`${embed}${embed.includes('?') ? '&' : '?'}autoplay=1`} title={title} allow="autoplay; fullscreen; picture-in-picture" ref={(f) => f?.focus()} />
          ) : (
            <button type="button" className="film-ph film-start" onClick={() => setPlaying(true)}>
              <span className="play" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
              <span className="film-ph-label">Play {title}</span>
              <span className="film-note">Plays from {embed.includes('vimeo') ? 'Vimeo' : 'YouTube'}, which may collect information or store data once it starts.</span>
            </button>
          )
        ) : (
          <video src={url} controls preload="metadata" />
        )
      ) : (
        <div className="film-ph">
          <span className="play" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
          <span className="film-ph-label">Placeholder · {p.film.caption ?? 'the short film'}, embedded</span>
        </div>
      )}
    </figure>
  )
}

export function Work({ design, elements }: BlockProps) {
  const { p, shown } = useCase()
  const el = useElement(elements)
  if (!shown.includes('work')) return null
  return (
    <Sec id="work" title={label(p, 'work')} wide design={design} titleProps={el('title', { className: 'c', field: 'labels:work' })}>
      <WorkContent p={p} el={el} />
      <Gallery key={p.slug} images={p.gallery} note={p.gallery_note} />
    </Sec>
  )
}

export function Outcomes({ design, elements }: BlockProps) {
  const { p, shown } = useCase()
  const el = useElement(elements)
  if (!shown.includes('outcomes')) return null
  return (
    <Sec id="outcomes" title={label(p, 'outcomes')} design={design} titleProps={el('title', { className: 'c', field: 'labels:outcomes' })}>
      {p.results_label && <span {...el('results-label', { className: 'lab', field: 'results_label', rich: true })}><Rich text={p.results_label} /></span>}
      {p.results?.length ? <Figures items={p.results} big el={el} field="results" /> : null}
      {p.outcome_note && <p {...el('note', { className: 'body-text outcome-note', field: 'outcome_note', rich: true })}><Rich text={p.outcome_note} /></p>}
      {p.skills?.length ? (
        <div className="skills">
          <span {...el('skills-label', { className: 'lab', field: 'labels:skills' })}>{label(p, 'skills')}</span>
          <p {...el('skills', { field: 'skills' })}>{p.skills.map((skill, i) => <Fragment key={skill}>{i > 0 && ' / '}<span>{skill}</span></Fragment>)}</p>
        </div>
      ) : null}
      {p.link && <a href={p.link.url} target="_blank" rel="noreferrer" className="text-link ext-link">{p.link.label} ↗</a>}
    </Sec>
  )
}

// ---- After the sections

export function AlsoIn({ design, elements }: BlockProps) {
  const { p } = useCase()
  const el = useElement(elements)
  const siblings = caseStudies.filter((x) => x.category === p.category && x.slug !== p.slug)
  if (!siblings.length) return null
  return (
    <nav aria-label={`Also in ${categoryName(p.category)}`} {...designProps(design, 'also')}>
      <span {...el('label', { className: 'lab' })}>Also in {categoryName(p.category)}</span>
      <ul>
        {siblings.map((x) => (
          <li key={x.slug}>
            <PageLink to={`/projects/${x.category}/${x.address}/`}>{x.title}</PageLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function PrevNext({ design }: BlockProps) {
  const { p } = useCase()
  if (caseStudies.length < 2) return null
  const idx = caseStudies.findIndex((x) => x.slug === p.slug)
  const prev = caseStudies[(idx - 1 + caseStudies.length) % caseStudies.length]
  const next = caseStudies[(idx + 1) % caseStudies.length]
  return (
    <nav aria-label="More projects" {...designProps(design, 'pn')}>
      <PageLink to={`/projects/${prev.category}/${prev.address}/`} className="pn-prev d-only">
        <span className="lab">← Previous</span><b className="c">{prev.title}</b>
      </PageLink>
      <PageLink to="/projects/" className="text-link pn-all">All projects →</PageLink>
      <PageLink to={`/projects/${next.category}/${next.address}/`} className="pn-next">
        <span className="lab">Next →</span><b className="c">{next.title}</b>
      </PageLink>
    </nav>
  )
}
