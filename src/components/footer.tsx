import { PageLink } from '#/components/page-link'
import { useElement, type Elements } from '#/layout/elements'
import { useFooterWords } from '#/lib/page-words'
import { mailto, site } from '#/lib/site'

// Shown on every page. Its words come from one place (src/lib/page-words.tsx), so a change in the
// visual editor shows on every page at once.
export default function Footer({ elements }: { elements?: Elements }) {
  const w = useFooterWords()
  const el = useElement(elements)
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
          <a href={mailto} className="footer-email">{site.email}</a>
          <div className="footer-social">
            {site.instagram && <a href={site.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>}
            {site.linkedin && <a href={site.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>}
          </div>
        </div>
        <div className="footer-bottom">
          <nav aria-label="Pages">
            <PageLink to="/">{w.pages.home}</PageLink>
            <PageLink to="/about/">{w.pages.about}</PageLink>
            <PageLink to="/projects/">{w.pages.projects}</PageLink>
          </nav>
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo(0, 0) }} {...el('top', { field: 'top' })}>{w.top}</a>
        </div>
      </div>
      <div className="footer-credit">
        <p>© {new Date().getFullYear()} Zafran Zakaria. All rights reserved.</p>
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
