import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Rich } from '#/components/rich'
import { imageProps, projects, site, yearOf } from '#/lib/site'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/')({ component: Home })

const featured = projects.filter((p) => p.featured && p.page_type === 'Full case study')

function Home() {
  useTitle()
  const [hover, setHover] = useState<string | null>(null)
  const preview = featured.find((p) => p.slug === hover && p.cover?.image)
  return (
    <main id="main" className="home">
      <p className="home-intro"><Rich text={site.home_intro} /></p>
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
                params={{ projectCat: p.category, projectId: p.slug }}
                className="work-link"
                onMouseEnter={() => setHover(p.slug)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(p.slug)}
                onBlur={() => setHover(null)}
              >
                <span className="c work-title">{p.title}</span>
                <span className="work-meta">
                  <span>{p.homepage_label ?? p.role} · {yearOf(p)}</span>
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
            <img {...imageProps(preview.cover?.image, '17vw')} alt="" />
            <figcaption><span>{preview.title}</span><span className="terra">View case study</span></figcaption>
          </figure>
        )}
      </div>
    </main>
  )
}
