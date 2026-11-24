import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { Rich } from '#/components/rich'
import { croppedSizes, cvUrl, imageProps, photoSize, projects, site, yearOf } from '#/lib/site'
import { frameFor } from '#/lib/cover-image.js'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/')({ component: Home })

const featured = projects.filter((p) => p.featured && p.page_type === 'Full case study')

function Home() {
  useTitle()
  const [hover, setHover] = useState<string | null>(null)
  const preview = featured.find((p) => p.slug === hover && p.cover?.image)
  return (
    <main id="main" className="home">
      <h1 className="visually-hidden">{site.name}</h1>
      <p className="home-intro"><Rich text={site.home_intro} highlight /></p>
      {site.clock && site.clock.show !== false && <Clock city={site.clock.city} timeZone={site.clock.time_zone} line={site.clock.line} />}
      {(site.availability || cvUrl) && (
        <p className="home-line">
          {site.availability && <span className="home-line-item">{site.availability}</span>}
          {site.availability && cvUrl && <span className="home-sep" aria-hidden="true">·</span>}
          {cvUrl && (
            <span className="home-line-item">
              <a href={cvUrl}>View CV (PDF)</a>
            </span>
          )}
        </p>
      )}
      <section aria-label="Areas of focus" className="home-focus">
        <h2 className="lab">Areas of Focus</h2>
        <ul>
          {site.areas_of_focus.map((a) => (
            <li key={a.label}>
              {a.category ? (
                <Link to="/projects/$projectCat/" params={{ projectCat: a.category }}>{a.label}<span className="hover-arrow"> →</span></Link>
              ) : (
                <Link to="/projects/">{a.label}<span className="hover-arrow"> →</span></Link>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section aria-label="Selected projects" className="home-work">
        <h2 className="lab">Selected Projects</h2>
        <ul>
          {featured.map((p) => (
            <li key={p.slug}>
              <Link
                to="/projects/$projectCat/$projectId/"
                params={{ projectCat: p.category, projectId: p.address }}
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
              </Link>
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
    </main>
  )
}

// The local time in the city chosen in Site settings. The visitor's browser works it out for that
// time zone, so daylight saving changes are followed automatically. It updates once a second and is
// not announced by screen readers on every change.
function Clock({ city, timeZone, line }: { city: string; timeZone: string; line?: string }) {
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
  return (
    <p className="home-clock">
      <span className="home-clock-now">
        <span>It is now</span> <time>{now}</time> <span>in {city}.</span>
      </span>
      {line && <> {line}</>}
    </p>
  )
}
