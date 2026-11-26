import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import CategoryIndex, { CategoryNames } from '#/components/category-index'
import { Media } from '#/components/media'
import { PageLink } from '#/components/page-link'
import { PaperClip } from '#/components/paper-clip'
import { ProjectBands } from '#/components/project-band'
import { Rich } from '#/components/rich'
import { Weather, useWeather } from '#/components/weather'
import { frameFor } from '#/lib/cover-image.js'
import { aboutWords, categoryWords, homeWords, projectsWords, usePageWords, type ListingWords } from '#/lib/page-words'
import { croppedSizes, cvUrl, imageProps, photoSize, projects, projectsIn, site, yearOf } from '#/lib/site'
import { designProps, type Design } from './design'
import { Editing, useElement, type Elements } from './elements'

// The parts of the homepage, About, Projects and category pages, as sections. The website draws
// them in their standard order; the design editor uses the same sections, so the canvas is the
// real page. Each one renders exactly the markup the page always had.

type BlockProps = { design?: Design; elements?: Elements }
const featured = projects.filter((p) => p.featured && p.page_type === 'Full case study')

// ---- Homepage

export const HOME_SECTIONS = ['HomeIntro', 'HomeClock', 'HomeLine', 'HomeFocus', 'HomeWork'] as const

export function HomeFrame({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="home">
      <h1 className="visually-hidden">{site.name}</h1>
      {children}
    </main>
  )
}

export function HomeIntro({ design, elements }: BlockProps) {
  const w = usePageWords(homeWords)
  const el = useElement(elements)
  return (
    <div {...designProps(design, 'home-intro')}>
      <p {...el('intro', { field: 'home_intro', rich: true })}><Rich text={w.home_intro} highlight /></p>
      {w.home_byline && <p {...merge({ className: 'home-byline' }, el('byline', { field: 'home_byline' }))}>{w.home_byline}</p>}
    </div>
  )
}
// designProps and el both give a class: merge them so neither is lost.
const merge = (a: { className?: string; style?: object }, b: { className?: string; style?: object }) => ({ ...a, ...b, className: [a.className, b.className].filter(Boolean).join(' ') || undefined, style: a.style || b.style ? { ...a.style, ...b.style } : undefined })

export function HomeClock({ design, elements }: BlockProps) {
  const w = usePageWords(homeWords)
  const el = useElement(elements)
  const editing = useContext(Editing)
  // Hidden: the website leaves it out; the editor keeps a faded line, so it can be chosen and shown again.
  if (!w.clock.show) return editing ? <p {...merge(designProps(design, 'home-clock editor-clock-off'), el('clock', {}))}>Clock hidden on the website. Choose it, then Settings, to show it again.</p> : null
  return <Clock city={w.clock.city} timeZone={w.clock.time_zone} line={w.clock.line} weather={w.clock.weather && !editing} lat={w.clock.latitude} lon={w.clock.longitude} props={merge(designProps(design, 'home-clock'), el('clock', { field: 'clock:line' }))} />
}

// The weather is not fetched inside the design editor: its security policy only lets it talk to this
// site and GitHub, and keeping it that way matters more than showing the temperature while editing.
// The local time in the chosen city. The visitor's browser works it out for that time zone, so
// daylight saving changes are followed automatically. It updates once a second and is not
// announced by screen readers on every change.
function Clock({ city, timeZone, line, weather, lat, lon, props }: { city: string; timeZone: string; line?: string; weather: boolean; lat?: number; lon?: number; props: object }) {
  const format = useMemo(() => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }), [timeZone])
  const [now, setNow] = useState(() => format.format(new Date()))
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(format.format(new Date()))
      timer = setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    tick()
    return () => clearTimeout(timer)
  }, [format])
  const reading = useWeather(weather ? lat : undefined, weather ? lon : undefined)
  return (
    <p {...props}>
      <span className="home-clock-now">
        <span>It is now</span>{' '}
        <span className="home-clock-time">
          <time>{now}</time>
          {reading && <> <Weather reading={reading} /></>}
        </span>{' '}
        <span>in {city}.</span>
      </span>
      {line && <> {line}</>}
    </p>
  )
}

export function HomeLine({ design, elements }: BlockProps) {
  const w = usePageWords(homeWords)
  const el = useElement(elements)
  if (!w.availability && !cvUrl) return null
  return (
    <p {...designProps(design, 'home-line')}>
      {w.availability && <span {...el('availability', { className: 'home-line-item', field: 'availability' })}>{w.availability}</span>}
      {w.availability && cvUrl && <span className="home-sep" aria-hidden="true">·</span>}
      {cvUrl && (
        <span className="home-line-item">
          <a href={cvUrl} {...el('cv-view', { field: 'labels:cv_view' })}>{w.labels.cv_view}</a>
        </span>
      )}
    </p>
  )
}

export function HomeFocus({ design, elements }: BlockProps) {
  const w = usePageWords(homeWords)
  const el = useElement(elements)
  return (
    <section aria-label="Areas of focus" {...designProps(design, 'home-focus')}>
      <h2 {...el('focus-heading', { className: 'lab', field: 'labels:focus' })}>{w.labels.focus}</h2>
      <ul>
        {w.areas_of_focus.map((a, i) => (
          <li key={i}>
            <PageLink to={a.category ? `/projects/${a.category}/` : '/projects/'}><span {...el(`focus-${i}`, { field: `areas_of_focus:${i}:label` })}>{a.label}</span><span className="hover-arrow"> →</span></PageLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function HomeWork({ design, elements }: BlockProps) {
  const w = usePageWords(homeWords)
  const el = useElement(elements)
  const [hover, setHover] = useState<string | null>(null)
  const preview = featured.find((p) => p.slug === hover && p.cover?.image)
  return (
    <>
      <section aria-label="Selected projects" {...designProps(design, 'home-work')}>
        <h2 {...el('work-heading', { className: 'lab', field: 'labels:work' })}>{w.labels.work}</h2>
        <ul>
          {featured.map((p) => (
            <li key={p.slug}>
              <PageLink
                to={`/projects/${p.category}/${p.address}/`}
                className="work-link"
                onMouseEnter={() => setHover(p.slug)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.slug)}
                onBlur={() => setHover(null)}
              >
                <span className="c work-title">{p.title}</span>
                <span className="work-meta">
                  <span><Rich text={p.homepage_label ?? p.role} /> · {yearOf(p)}</span>
                  <span className="hover-arrow"> →</span>
                </span>
                <span className="work-arrow" aria-hidden="true">→</span>
              </PageLink>
            </li>
          ))}
        </ul>
      </section>
      <div className="home-preview" aria-hidden="true">
        {preview && (
          <figure>
            {/* The preview's 4:5 frame is used only for covers it would not crop; any other cover is
                shown whole, by the same rule as the project pages (src/lib/cover-image.js). */}
            {frameFor('4/5', photoSize(preview.cover?.image)) === 'auto'
              ? <img {...imageProps(preview.cover?.image, '17vw')} className="whole" alt="" />
              : <img {...imageProps(preview.cover?.image, croppedSizes('17vw', preview.cover?.image, 4 / 5))} alt="" />}
            <figcaption><span>{preview.title}</span><span className="terra">View case study</span></figcaption>
          </figure>
        )}
      </div>
    </>
  )
}

// ---- About

export const ABOUT_SECTIONS = ['AboutHero', 'AboutIntro', 'AboutSkills', 'AboutEducation', 'AboutExperience'] as const

export function AboutFrame({ children }: { children: ReactNode }) {
  return <main id="main" className="about">{children}</main>
}

// The label column (number and heading) sits beside the content, with its cap height
// aligned to the first line of content, as approved on the Clay About board.
function Section({ n, title, children, design, heading }: { n: string; title: string; children: ReactNode; design?: Design; heading: object }) {
  return (
    <section aria-label={title} {...designProps(design, 'ix-sec')}>
      <div className="ix-label">
        <span className="lab">{n}</span>
        <h2 {...merge({ className: 'c' }, heading)}>{title}</h2>
      </div>
      <div className="ix-body">{children}</div>
    </section>
  )
}

function EduRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="edu-row"><span className="edu-key">{label}</span><span className="edu-val">{children}</span></div>
}

export function AboutHero({ design, elements }: BlockProps) {
  const w = usePageWords(aboutWords)
  const el = useElement(elements)
  return (
    <>
      <section {...designProps(design, 'about-hero')}>
        <span {...el('kicker', { className: 'about-kicker', field: 'labels:kicker' })}>{w.labels.kicker}</span>
        <div className="about-title-clip"><h1 className="c">About <br className="m-only" />me</h1></div>
        <figure {...merge({ className: 'about-portrait' }, el('portrait'))}>
          {w.portrait?.image ? (
            <div className="about-photo">
              <PaperClip layer="back" />
              <Media img={w.portrait} ratio="4/5" sizes="(max-width: 899px) 140px, 20vw" />
              <PaperClip layer="front" />
            </div>
          ) : (
            <Media img={w.portrait} ratio="4/5" label="Needed: portrait photograph" sizes="(max-width: 899px) 140px, 20vw" />
          )}
          <figcaption className="d-only"><b>{w.name}</b><span {...el('caption', { field: 'portrait_caption' })}>{w.portrait_caption}</span></figcaption>
        </figure>
      </section>
      <div className="about-caption m-only"><b>{w.name}</b><span>{w.portrait_caption}</span></div>
    </>
  )
}

export function AboutIntro({ design, elements }: BlockProps) {
  const w = usePageWords(aboutWords)
  const el = useElement(elements)
  return (
    <section aria-label="Intro" {...designProps(design, 'ix-sec')}>
      <div className="ix-label"><span className="lab">01</span><h2 {...el('intro-heading', { className: 'c', field: 'labels:intro' })}>{w.labels.intro}</h2></div>
      <div className="ix-body ix-body-intro">
        <p {...el('intro', { className: 'about-statement', field: 'intro', rich: true })}><Rich text={w.intro} highlight /></p>
        {w.intro_more && <p {...el('intro-more', { className: 'about-more', field: 'intro_more', rich: true })}><Rich text={w.intro_more} /></p>}
        {w.languages?.length ? (
          <p className="about-languages"><b {...el('languages-heading', { field: 'labels:languages' })}>{w.labels.languages}</b><br />{w.languages.map((l, i) => <span key={i}>{i > 0 && <><br className="d-only" /><span className="m-only"> · </span></>}<span {...el(`language-${i}`, { field: `languages:${i}` })}>{l}</span></span>)}</p>
        ) : null}
      </div>
    </section>
  )
}

export function AboutSkills({ design, elements }: BlockProps) {
  const w = usePageWords(aboutWords)
  const el = useElement(elements)
  if (!w.skills?.length) return null
  return (
    <Section n="02" title={w.labels.skills} design={design} heading={el('skills-heading', { field: 'labels:skills' })}>
      {w.skills.map((s, i) => (
        <div key={i} className="ix-row">
          <span className="lab">{String(i + 1).padStart(2, '0')}</span>
          <b {...el(`skill-${i}`, { className: 'c ix-row-title', field: `skills:${i}:title` })}>{s.title}</b>
          <span {...el(`skill-note-${i}`, { className: 'ix-row-note', field: `skills:${i}:text`, rich: true })}><Rich text={s.text} /></span>
        </div>
      ))}
    </Section>
  )
}

export function AboutEducation({ design, elements }: BlockProps) {
  const w = usePageWords(aboutWords)
  const el = useElement(elements)
  const edu = w.education ?? []
  if (!edu.length) return null
  return (
    <Section n="03" title={w.labels.education} design={design} heading={el('education-heading', { field: 'labels:education' })}>
      {edu.map((e, k) => (
        <div key={k} className="edu">
          {e.qualification && <EduRow label="Qualification"><b {...el(`edu-qualification-${k}`, { className: 'w600', field: `education:${k}:qualification` })}>{e.qualification}</b></EduRow>}
          {e.course && <EduRow label="Course"><span {...el(`edu-course-${k}`, { field: `education:${k}:course` })}>{e.course}</span></EduRow>}
          {e.institution && <EduRow label="Institution"><b {...el(`edu-institution-${k}`, { className: 'w600 terra', field: `education:${k}:institution` })}>{e.institution}</b></EduRow>}
          {e.years && <EduRow label="Years"><span {...el(`edu-years-${k}`, { className: 'terra', field: `education:${k}:years` })}>{e.years}</span></EduRow>}
          {e.result && (
            <div className="edu-row edu-last">
              <span className="edu-key">Result</span>
              <span className="edu-val"><span {...el(`edu-result-${k}`, { field: `education:${k}:result` })}><Rich text={`**${e.result}**`} highlight /></span></span>
              {e.note && <p {...el(`edu-note-${k}`, { className: 'edu-note', field: `education:${k}:note`, rich: true })}><Rich text={e.note} /></p>}
            </div>
          )}
        </div>
      ))}
    </Section>
  )
}

export function AboutExperience({ design, elements }: BlockProps) {
  const w = usePageWords(aboutWords)
  const el = useElement(elements)
  if (!w.experience?.length) return null
  return (
    <Section n="04" title={w.labels.experience} design={design} heading={el('experience-heading', { field: 'labels:experience' })}>
      {w.experience.map((x, i) => (
        <div key={i} className="ix-row">
          <span {...el(`role-years-${i}`, { className: 'lab', field: `experience:${i}:years` })}>{x.years}</span>
          <b {...el(`role-${i}`, { className: 'c ix-row-title ix-row-title-exp', field: `experience:${i}:role` })}>{x.role}</b>
          <span className="ix-row-note">
            {x.organisation && <b {...el(`role-org-${i}`, { className: 'w600 terra', field: `experience:${i}:organisation` })}>{x.organisation}</b>}
            {x.organisation && x.note && <br />}
            {x.note && <span {...el(`role-note-${i}`, { field: `experience:${i}:note`, rich: true })}><Rich text={x.note} /></span>}
          </span>
        </div>
      ))}
    </Section>
  )
}

// ---- Projects and category pages

export const LISTING_SECTIONS = ['ListingHead', 'ListingBands'] as const

export function ListingFrame({ category, children }: { category?: string; children: ReactNode }) {
  return <main id="main" className={category ? 'listing listing-cat' : 'listing'}>{children}</main>
}

const listingWords = (category?: string): (() => ListingWords) => () => (category ? categoryWords(category) : projectsWords())

export function ListingHead({ design, elements, category }: BlockProps & { category?: string }) {
  const w = usePageWords(listingWords(category))
  const el = useElement(elements)
  const renamed = useContext(CategoryNames)
  return (
    <section {...designProps(design, 'listing-head')}>
      {category && <span className="lab cat-count">{w.labels?.category ?? 'Category'} · {w.count} {w.count === 1 ? 'project' : 'projects'}</span>}
      {/* A category's title is its name, which is shared with every page that shows it. */}
      <h1 {...el('title', { className: category ? 'c listing-title cat-title' : 'c listing-title', field: category ? `category:${category}` : 'title' })}>{(category && renamed[category]) || w.title}</h1>
      {w.intro && <p {...el('intro', { className: 'listing-intro', field: 'intro', rich: true })}><Rich text={w.intro} /></p>}
      <CategoryIndex current={category ?? 'all'} />
    </section>
  )
}

export function ListingBands({ category }: BlockProps & { category?: string }) {
  return category ? <ProjectBands items={projectsIn(category)} /> : <ProjectBands items={projects} all />
}
