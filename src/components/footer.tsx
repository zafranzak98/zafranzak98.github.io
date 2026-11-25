import { PageLink } from '#/components/page-link'
import { useContext } from 'react'
import { Editing, useElement, type Elements } from '#/layout/elements'
import { useFooterWords } from '#/lib/page-words'
import { site } from '#/lib/site'

// Shown on every page. Its words come from one place (src/lib/page-words.tsx), so a change in the
// visual editor shows on every page at once.
export default function Footer({ elements }: { elements?: Elements }) {
  const w = useFooterWords()
  const el = useElement(elements)
  // On the website the line is one run of text, exactly as before; the editor marks the words only.
  const editing = useContext(Editing)
  const [first, ...rest] = w.title.split(' ')
  return (
    <footer>
      <div className="footer-main">
        <div>
          <p {...el('kicker', { className: 'footer-kicker', field: 'kicker' })}>{w.kicker}</p>
          <h2 {...el('title', { className: 'c footer-title', field: 'title' })}>
            {first} <br className="m-only" />
            {rest.join(' ')}
          </h2>
        </div>
        <div>
          <a href={`mailto:${w.email}`} {...el('email', { className: 'footer-email', field: 'email' })}>{w.email}</a>
          <div className="footer-social">
            {site.instagram && <a href={site.instagram} target="_blank" rel="noreferrer"><span {...el('social-instagram', { field: 'social:instagram' })}>{w.social.instagram}</span></a>}
            {site.linkedin && <a href={site.linkedin} target="_blank" rel="noreferrer"><span {...el('social-linkedin', { field: 'social:linkedin' })}>{w.social.linkedin}</span></a>}
          </div>
        </div>
        <div className="footer-bottom">
          <nav aria-label="Pages">
            <PageLink to="/"><span {...el('page-home', { field: 'pages:home' })}>{w.pages.home}</span></PageLink>
            <PageLink to="/about/"><span {...el('page-about', { field: 'pages:about' })}>{w.pages.about}</span></PageLink>
            <PageLink to="/projects/"><span {...el('page-projects', { field: 'pages:projects' })}>{w.pages.projects}</span></PageLink>
          </nav>
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo(0, 0) }} {...el('top', { field: 'top' })}>{w.top}</a>
        </div>
      </div>
      <div className="footer-credit">
        {/* The year updates by itself; the words after it can be changed. */}
        <p>© {new Date().getFullYear()}{editing ? <>{' '}<span {...el('credit', { field: 'credit' })}>{w.credit}</span></> : ` ${w.credit}`}</p>
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
