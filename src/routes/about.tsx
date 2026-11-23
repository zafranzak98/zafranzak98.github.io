import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { PaperClip } from '#/components/paper-clip'
import { Media } from '#/components/media'
import { Rich } from '#/components/rich'
import { about, site } from '#/lib/site'
import { useTitle } from '#/lib/title'

export const Route = createFileRoute('/about')({ component: About })

// The label column (number and heading) sits beside the content, with its cap height
// aligned to the first line of content, as approved on the Clay About board.
function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="ix-sec">
      <div className="ix-label">
        <span className="lab">{n}</span>
        <h2 className="c">{title}</h2>
      </div>
      <div className="ix-body">{children}</div>
    </section>
  )
}

function EduRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="edu-row"><span className="edu-key">{label}</span><span className="edu-val">{children}</span></div>
}

function About() {
  useTitle('About')
  const edu = about.education ?? []
  return (
    <main id="main" className="about">
      <section className="about-hero">
        <span className="about-kicker">About</span>
        <div className="about-title-clip"><h1 className="c">About <br className="m-only" />me</h1></div>
        <figure className="about-portrait">
          {about.portrait?.image ? (
            <div className="about-photo">
              <PaperClip layer="back" />
              <Media img={about.portrait} ratio="4/5" sizes="(max-width: 899px) 140px, 20vw" />
              <PaperClip layer="front" />
            </div>
          ) : (
            <Media img={about.portrait} ratio="4/5" label="Needed: portrait photograph" sizes="(max-width: 899px) 140px, 20vw" />
          )}
          <figcaption className="d-only"><b>{site.name}</b><span>{about.portrait_caption}</span></figcaption>
        </figure>
      </section>
      <div className="about-caption m-only"><b>{site.name}</b><span>{about.portrait_caption}</span></div>

      <section aria-label="Intro" className="ix-sec">
        <div className="ix-label"><span className="lab">01</span><h2 className="c">Intro</h2></div>
        <div className="ix-body ix-body-intro">
          <p className="about-statement"><Rich text={about.intro} highlight /></p>
          {about.intro_more && <p className="about-more"><Rich text={about.intro_more} /></p>}
          {about.languages?.length ? (
            <p className="about-languages"><b>Languages</b><br />{about.languages.map((l, i) => <span key={l}>{i > 0 && <><br className="d-only" /><span className="m-only"> · </span></>}{l}</span>)}</p>
          ) : null}
        </div>
      </section>

      {about.skills?.length ? (
        <Section n="02" title="Skills">
          {about.skills.map((s, i) => (
            <div key={i} className="ix-row">
              <span className="lab">{String(i + 1).padStart(2, '0')}</span>
              <b className="c ix-row-title">{s.title}</b>
              <span className="ix-row-note"><Rich text={s.text} /></span>
            </div>
          ))}
        </Section>
      ) : null}

      {edu.length ? (
        <Section n="03" title="Education">
          {edu.map((e, k) => (
            <div key={k} className="edu">
              {e.qualification && <EduRow label="Qualification"><b className="w600">{e.qualification}</b></EduRow>}
              {e.course && <EduRow label="Course">{e.course}</EduRow>}
              {e.institution && <EduRow label="Institution"><b className="w600 terra">{e.institution}</b></EduRow>}
              {e.years && <EduRow label="Years"><span className="terra">{e.years}</span></EduRow>}
              {e.result && (
                <div className="edu-row edu-last">
                  <span className="edu-key">Result</span>
                  <span className="edu-val"><Rich text={`**${e.result}**`} highlight /></span>
                  {e.note && <p className="edu-note"><Rich text={e.note} /></p>}
                </div>
              )}
            </div>
          ))}
        </Section>
      ) : null}

      {about.experience?.length ? (
        <Section n="04" title="Experience">
          {about.experience.map((x, i) => (
            <div key={i} className="ix-row">
              <span className="lab">{x.years}</span>
              <b className="c ix-row-title ix-row-title-exp">{x.role}</b>
              <span className="ix-row-note">
                {x.organisation && <b className="w600 terra">{x.organisation}</b>}
                {x.organisation && x.note && <br />}
                <Rich text={x.note} />
              </span>
            </div>
          ))}
        </Section>
      ) : null}
    </main>
  )
}
