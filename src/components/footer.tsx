import { Link } from '@tanstack/react-router'
import { mailto, site } from '#/lib/site'

export default function Footer() {
  return (
    <footer>
      <div className="footer-main">
        <div>
          <p className="footer-kicker">Contact</p>
          <h2 className="c footer-title">
            Let's <br className="m-only" />
            talk
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
            <Link to="/">Home</Link>
            <Link to="/about/">About</Link>
            <Link to="/projects/">Projects</Link>
          </nav>
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo(0, 0) }}>Back to top ↑</a>
        </div>
      </div>
      {site.credit_name && (
        <div className="footer-credit">
          <p>
            website by{' '}
            <a href={site.credit_url} target="_blank" rel="noreferrer" className="credit-link">{site.credit_name}</a>
          </p>
        </div>
      )}
    </footer>
  )
}
