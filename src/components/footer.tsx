import { PageLink } from '#/components/page-link'
import { useContext } from 'react'
import { Editing, useElement, type Elements } from '#/layout/elements'
import { useFooterWords } from '#/lib/page-words'
import { site } from '#/lib/site'

// Shown on every page. Its words come from one place (src/lib/page-words.tsx), so a change in the
// visual editor shows on every page at once.
// The homepage weather is switched on in Site settings (clock: weather).
const weatherOn = !!site.clock && site.clock.show !== false && site.clock.weather === true

export default function Footer({ elements }: { elements?: Elements }) {
  const w = useFooterWords()
  const el = useElement(elements)
  // On the website the line is one run of text, exactly as before; the editor marks the words only.
  const editing = useContext(Editing)
  const [first, ...rest] = w.title.split(' ')
  // A cleared word is left out for visitors (no empty links or headings); in the editor it stays, faded.
  const show = (words: string) => !!words || editing
  return (
    <footer>
      <div className="footer-main">
        <div>
          {show(w.kicker) && <p {...el('kicker', { className: 'footer-kicker', field: 'kicker' })}>{w.kicker}</p>}
          {show(w.title) && (
            <h2 {...el('title', { className: 'c footer-title', field: 'title' })}>
              {w.title && <>{first} <br className="m-only" />{rest.join(' ')}</>}
            </h2>
          )}
        </div>
        <div>
          {show(w.email) && <a href={`mailto:${w.email}`} {...el('email', { className: 'footer-email', field: 'email' })}>{w.email}</a>}
          <div className="footer-social">
            {site.instagram && show(w.social.instagram) && <a href={site.instagram} target="_blank" rel="noreferrer"><span {...el('social-instagram', { field: 'social:instagram' })}>{w.social.instagram}</span></a>}
            {site.linkedin && show(w.social.linkedin) && <a href={site.linkedin} target="_blank" rel="noreferrer"><span {...el('social-linkedin', { field: 'social:linkedin' })}>{w.social.linkedin}</span></a>}
          </div>
        </div>
        <div className="footer-bottom">
          <nav aria-label="Pages">
            {show(w.pages.home) && <PageLink to="/"><span {...el('page-home', { field: 'pages:home' })}>{w.pages.home}</span></PageLink>}
            {show(w.pages.about) && <PageLink to="/about/"><span {...el('page-about', { field: 'pages:about' })}>{w.pages.about}</span></PageLink>}
            {show(w.pages.projects) && <PageLink to="/projects/"><span {...el('page-projects', { field: 'pages:projects' })}>{w.pages.projects}</span></PageLink>}
          </nav>
          {show(w.top) && <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo(0, 0) }} {...el('top', { field: 'top' })}>{w.top}</a>}
        </div>
      </div>
      <div className="footer-credit">
        {/* The year updates by itself; the words after it can be changed. */}
        <p>© {new Date().getFullYear()}{editing || elements?.credit ? <>{' '}<span {...el('credit', { field: 'credit' })}>{w.credit}</span></> : ` ${w.credit}`}</p>
        {weatherOn && (
          // Open-Meteo's data is shared under CC BY 4.0, which asks for this credit wherever it is shown.
          <p className="credit">
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="credit-link">
              Weather data by <span>Open-Meteo.com</span>
            </a>
          </p>
        )}
        {site.credit_name && (
          <p className="credit">
            <a href={site.credit_url} target="_blank" rel="noreferrer" className="credit-link">
              Original website development by <span>{site.credit_name}</span>
            </a>
          </p>
        )}
      </div>
    </footer>
  )
}
