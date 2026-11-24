import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { asset, cvFileName, cvUrl, mailto, site } from '#/lib/site'

export default function Header() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  const done = () => setOpen(false)
  return (
    <header className="site-header">
      <Link to="/" className="brand" aria-label={`${site.name}, home`} onClick={done}>
        <img src={asset('/brand-mark-48.png?v=2')} width="36" height="36" alt="" />
        <b className="c">{site.name}</b>
      </Link>
      <nav aria-label="Main" className="nav-desktop">
        <Link to="/about/">About</Link>
        <Link to="/projects/">Projects</Link>
        {cvUrl && <a href={cvUrl} download={cvFileName}>CV</a>}
        <a href={mailto} className="nav-gap">Email</a>
        {site.instagram && <a href={site.instagram} target="_blank" rel="noreferrer">Instagram</a>}
        {site.linkedin && <a href={site.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
      </nav>
      <button type="button" className="menu-button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d={open ? 'M6 6l12 12M18 6 6 18' : 'M3 7h18M3 12h18M3 17h18'} />
        </svg>
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Menu" className="menu-panel">
          <Link to="/about/" onClick={done}>About</Link>
          <Link to="/projects/" onClick={done}>Projects</Link>
          {cvUrl && <a href={cvUrl} download={cvFileName} onClick={done}>Download CV</a>}
          <a href={mailto} className="menu-sep" onClick={done}>Email</a>
          {site.instagram && <a href={site.instagram} target="_blank" rel="noreferrer" onClick={done}>Instagram</a>}
          {site.linkedin && <a href={site.linkedin} target="_blank" rel="noreferrer" onClick={done}>LinkedIn</a>}
        </nav>
      )}
    </header>
  )
}
