import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Media } from '#/components/media'
import { Rich } from '#/components/rich'
import { about, site } from '#/lib/site'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/about')({ component: About })

// The label column (number and heading) sits beside the content, with its cap height
// aligned to the first line of content, as approved on the Clay About board.
function Section({ n, title, children, wide }: { n: string; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <section aria-label={title} className="ix-sec">
      <div className={`ix-label ix-label-${title.toLowerCase()}`}>
        <span className="lab">{n}</span>
        <h2 className="c">{title}</h2>
      </div>
      <div className={wide ? 'ix-body' : 'ix-body ix-body-narrow'}>{children}</div>
    </section>
  )
}

function About() {
  useTitle('About')
  const edu = about.education ?? []
  return (
    <main className="about">
      <section className="about-hero">
        <span className="about-kicker">About</span>
        <div className="about-title-clip"><h1 className="c">About <br className="m-only" />me</h1></div>
        <figure className="about-portrait">
          <Media img={about.portrait} ratio="4/5" label="Needed: portrait photograph" tone="sage" />
          <figcaption className="d-only"><b>{site.name}</b><span>{about.portrait_caption}</span></figcaption>
        </figure>
      </section>
      <div className="about-caption m-only"><b>{site.name}</b><span>{about.portrait_caption}</span></div>

      <section aria-label="Intro" className="ix-sec">
        <div className="ix-label ix-label-intro"><span className="lab">01</span><h2 className="c">Intro</h2></div>
        <div className="ix-body ix-body-intro">
          <p className="about-statement"><Rich text={about.intro} /></p>
          {about.intro_more && <p className="about-more">{about.intro_more}</p>}
        </div>
        {about.languages?.length ? (
          <p className="about-languages"><b>Languages</b><br />{about.languages.map((l, i) => <span key={l}>{i > 0 && <><br className="d-only" /><span className="m-only"> · </span></>}{l}</span>)}</p>
        ) : null}
      </section>

      {about.skills?.length ? (
        <Section n="02" title="Skills" wide>
          {about.skills.map((s, i) => (
            <div key={i} className="ix-row">
              <span className="lab">{String(i + 1).padStart(2, '0')}</span>
              <b className="c ix-row-title">{s.title}</b>
              <span className="ix-row-note">{s.text}</span>
            </div>
          ))}
        </Section>
      ) : null}

      {edu.length ? (
        <Section n="03" title="Education" wide>
          {edu.map((e, k) => (
            <div key={k} className="edu">
              {[
                ['Qualification', <b className="w600">{e.qualification}</b>],
                ['Course', e.course],
                ['Institution', e.institution && <b className="w600 terra">{e.institution}</b>],
                ['Years', e.years && <span className="terra">{e.years}</span>],
              ]
                .filter(([, v]) => v)
                .map(([k2, v]) => (
                  <div key={k2 as string} className="edu-row"><span className="edu-key">{k2}</span><span className="edu-val">{v}</span></div>
                ))}
              {e.result && (
                <div className="edu-row edu-last">
                  <span className="edu-key">Result</span>
                  <b className="edu-val terra">{e.result}</b>
                  {e.note && <p className="edu-note">{e.note}</p>}
                </div>
              )}
            </div>
          ))}
        </Section>
      ) : null}

      {about.experience?.length ? (
        <Section n="04" title="Experience" wide>
          {about.experience.map((x, i) => (
            <div key={i} className="ix-row">
              <span className="lab">{x.years}</span>
              <b className="c ix-row-title ix-row-title-exp">{x.role}</b>
              <span className="ix-row-note">
                {x.organisation && <b className="w600 terra">{x.organisation}</b>}
                {x.organisation && x.note && <br />}
                {x.note}
              </span>
            </div>
          ))}
        </Section>
      ) : null}
    </main>
  )
}
