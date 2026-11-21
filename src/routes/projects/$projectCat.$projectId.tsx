import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import Gallery from '#/components/gallery'
import { Media, Phone } from '#/components/media'
import { Rich } from '#/components/rich'
import { OPENING, caseStudies, categoryName, projectBySlug, yearOf, type Img, type Project } from '#/lib/site'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/projects/$projectCat/$projectId')({
  loader: ({ params }) => {
    const project = projectBySlug(params.projectId)
    if (!project || project.category !== params.projectCat) throw notFound()
    return { project }
  },
  component: CaseStudy,
})

const SECTIONS = [
  ['overview', '01', 'Overview'],
  ['research', '02', 'Research & thinking'],
  ['work', '03', 'The work'],
  ['outcomes', '04', 'Outcomes'],
] as const

// ---- Opening visual: each existing case study keeps its own approved composition. New projects use the standard one.
function OpeningVisual({ p }: { p: Project }) {
  switch (p.design) {
    case 'cancel-me-not':
      return <div className="tilt"><Media img={p.cover} ratio="3/4" /></div>
    case 'evoke':
      return (
        <div className="pair">
          <Media img={p.cover_before} ratio="3/4" label="before" />
          <Media img={p.cover} ratio="3/4" label="after" />
        </div>
      )
    case 'about-face':
      return <Phone img={p.cover} width={200} />
    case 'bersih':
      return <Media img={p.cover} ratio="4/5" label="poster" />
    default:
      return <Media img={p.cover} ratio="3/4" label="strongest image" />
  }
}

const caption = (img?: Img) => img?.caption && <p className="cap">{img.caption}</p>

// ---- The work: same section on every project, laid out as approved for each one.
function Work({ p }: { p: Project }) {
  const sup = p.supporting ?? []
  const grid = (framed = false) =>
    sup.length > 0 && (
      <div className={`work-grid cols-${sup.length}${framed ? ' work-grid-framed' : ''}`}>
        {sup.map((s, i) => (
          <figure key={i}>
            <Media img={s} ratio="4/5" />
            {caption(s)}
          </figure>
        ))}
      </div>
    )
  const key = p.key_piece && (
    <figure className="work-key">
      <Media img={p.key_piece} ratio="16/9" />
      {caption(p.key_piece)}
    </figure>
  )
  const note = p.supporting_note && <p className="cap">{p.supporting_note}</p>
  switch (p.design) {
    case 'about-face':
      return (
        <>
          <div className="phones">{sup.map((s, i) => <Phone key={i} img={s} width={220} caption={s.caption} />)}</div>
          {note}
        </>
      )
    case 'bersih':
      return (
        <>
          {key}
          {grid()}
          {p.context && (
            <div className="work-context">
              <Media img={p.context} ratio="9/16" />
              <p>{p.context.text}</p>
            </div>
          )}
        </>
      )
    case 'evoke':
      return <>{key}{grid(true)}{note}</>
    case 'fc-yeah':
      return <>{key}{grid()}{note}<Film p={p} /></>
    default:
      return <>{key}{grid()}{note}<Film p={p} /></>
  }
}

function Film({ p }: { p: Project }) {
  if (!p.film) return null
  const url = p.film.url
  const embed = url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'))
  return (
    <figure className="film">
      {url ? (
        embed ? (
          <iframe src={url} title={p.film.caption ?? `${p.title} film`} allow="fullscreen; picture-in-picture" loading="lazy" />
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

function Sec({ id, n, title, children, wide }: { id: string; n: string; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section id={id} className={wide ? 'cs-sec cs-sec-wide' : 'cs-sec'}>
      <div className="cs-label"><span className="lab">{n}</span><h2 className="c">{title}</h2></div>
      <div className="cs-body">{children}</div>
    </section>
  )
}

const Figures = ({ items, big }: { items: { figure: string; label: string }[]; big?: boolean }) => (
  <div className={big ? 'figures figures-big' : 'figures'}>
    {items.map((f, i) => <div key={i}><b className="c">{f.figure}</b><span>{f.label}</span></div>)}
  </div>
)

function CaseStudy() {
  const { project: p } = Route.useLoaderData()
  useTitle(p.title)
  const idx = caseStudies.findIndex((x) => x.slug === p.slug)
  const prev = caseStudies[(idx - 1 + caseStudies.length) % caseStudies.length]
  const next = caseStudies[(idx + 1) % caseStudies.length]
  const siblings = caseStudies.filter((x) => x.category === p.category && x.slug !== p.slug)
  const o = OPENING[p.opening_colour]
  const type = [p.project_type, p.type_detail].filter(Boolean).join(' · ')
  const facts = [
    ['My role', p.role],
    ['Type', type],
    ['When', p.when],
    ['Deliverables', p.deliverables?.join(', ')],
    ['Tools', p.tools?.join(', ')],
  ].filter(([, v]) => v)
  const r = p.research

  // Highlights the section currently on screen in the sticky section nav.
  const [active, setActive] = useState<string>('overview')
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-30% 0px -60% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [p.slug])

  return (
    <main className="case">
      <section className="cs-open" style={{ background: o.bg, color: o.fg }}>
        <nav aria-label="Breadcrumb" className="crumbs">
          <span>
            <Link to="/projects">Projects</Link> /{' '}
            <Link to="/projects/$projectCat" params={{ projectCat: p.category }}>{categoryName(p.category)}</Link>
            <span className="d-only"> / <b>{p.title}</b></span>
          </span>
          <span className="d-only">Project {idx + 1} of {caseStudies.length}</span>
        </nav>
        <div className="cs-open-grid">
          <div className="cs-open-text">
            <span className="cs-sub" style={{ color: o.sub }}>
              {categoryName(p.category)} · {yearOf(p)}<span className="m-only"> · {idx + 1} of {caseStudies.length}</span>
              {p.status === 'Draft' && <span className="draft-badge">Draft</span>}
            </span>
            <h1 className="c cs-title">{p.title}</h1>
            <p className="cs-line">{p.summary}</p>
          </div>
          <div className="cs-open-visual"><OpeningVisual p={p} /></div>
        </div>
      </section>

      <section className="facts">
        {facts.map(([k, v]) => <div key={k}><span className="lab">{k}</span><span className="fact-val">{v}</span></div>)}
      </section>

      <nav aria-label="On this page" className="secnav">
        {SECTIONS.map(([id, n, t]) => (
          <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>
            <span className="d-only">{n} </span>{t}
          </a>
        ))}
      </nav>
      <div className="cs-gap" />

      <Sec id="overview" n="01" title="Overview">
        {p.objective && <p className="lead">{p.objective}</p>}
        <div className={p.what_team_did ? 'did did-two' : 'did'}>
          {p.what_i_did && <div><span className="lab">What I did</span><p><Rich text={p.what_i_did} /></p></div>}
          {p.what_team_did && <div><span className="lab">What the team did</span><p><Rich text={p.what_team_did} /></p></div>}
        </div>
      </Sec>

      <Sec id="research" n="02" title="Research & thinking">
        {r?.stats?.length ? <Figures items={r.stats} /> : null}
        {r?.text && <p className="lead">{r.text}</p>}
        {r?.extra && <p className="body-text">{r.extra}</p>}
        {r?.moodboard && <div className="mood"><Media img={r.moodboard} ratio="21/9" label="moodboard" /></div>}
      </Sec>

      <Sec id="work" n="03" title="The work" wide>
        <Work p={p} />
        <Gallery images={p.gallery} note={p.gallery_note} />
      </Sec>

      <Sec id="outcomes" n="04" title="Outcomes" wide>
        {p.results_label && <span className="lab">{p.results_label}</span>}
        {p.results?.length ? <Figures items={p.results} big /> : null}
        {p.outcome_note && <p className="body-text outcome-note">{p.outcome_note}</p>}
        {p.skills?.length ? (
          <div className="skills">
            <span className="lab">Skills shown</span>
            <p>{p.skills.join(' / ')}</p>
          </div>
        ) : null}
        {p.link && <a href={p.link.url} target="_blank" rel="noreferrer" className="text-link ext-link">{p.link.label} ↗</a>}
      </Sec>

      {siblings.length > 0 && (
        <nav aria-label={`Also in ${categoryName(p.category)}`} className="also">
          <span className="lab">Also in {categoryName(p.category)}</span>
          <ul>
            {siblings.map((x) => (
              <li key={x.slug}>
                <Link to="/projects/$projectCat/$projectId" params={{ projectCat: x.category, projectId: x.slug }}>{x.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {caseStudies.length > 1 && (
        <nav aria-label="More projects" className="pn">
          <Link to="/projects/$projectCat/$projectId" params={{ projectCat: prev.category, projectId: prev.slug }} className="pn-prev d-only">
            <span className="lab">← Previous</span><b className="c">{prev.title}</b>
          </Link>
          <Link to="/projects" className="text-link pn-all">All projects →</Link>
          <Link to="/projects/$projectCat/$projectId" params={{ projectCat: next.category, projectId: next.slug }} className="pn-next">
            <span className="lab">Next →</span><b className="c">{next.title}</b>
          </Link>
        </nav>
      )}
    </main>
  )
}
