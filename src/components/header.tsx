import { useContext, useEffect, useState } from 'react'
import { PageLink } from '#/components/page-link'
import { Editing, lookAt, useElement, type Elements } from '#/layout/elements'
import { useHeaderWords } from '#/lib/page-words'
import { asset, cvFileName, cvUrl, mailto, site } from '#/lib/site'

// Shown on every page. Its words come from one place (src/lib/page-words.tsx), so a change in the
// visual editor shows on every page at once.
export default function Header({ elements, menuOpen }: { elements?: Elements; menuOpen?: boolean }) {
  const w = useHeaderWords()
  const el = useElement(elements)
  // The phone menu leaves out a link that has no words or is hidden on phones.
  const onPhone = (key: string, words: string) => !!words && !lookAt(elements?.[key], 'phone').hidden
  // A cleared word is left out for visitors (no empty links); in the editor it stays, faded, to fill again.
  const editing = useContext(Editing)
  const show = (words: string) => !!words || editing
  const [open, setOpen] = useState(!!menuOpen)
  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  const done = () => setOpen(false)
  return (
    <header className="site-header">
      <PageLink to="/" className="brand" aria-label={w.name ? `${w.name}, home` : 'Home'} onClick={done}>
        <img src={asset('/brand-mark-48.png?v=2')} width="36" height="36" alt="" />
        {(w.name || editing) && <b {...el('name', { className: 'c', field: 'name' })}>{w.name}</b>}
      </PageLink>
      <nav aria-label="Main" className="nav-desktop">
        {show(w.nav.about) && <PageLink to="/about/"><span {...el('nav-about', { field: 'nav:about' })}>{w.nav.about}</span></PageLink>}
        {show(w.nav.projects) && <PageLink to="/projects/"><span {...el('nav-projects', { field: 'nav:projects' })}>{w.nav.projects}</span></PageLink>}
        {cvUrl && show(w.nav.cv) && <a href={cvUrl} download={cvFileName}><span {...el('nav-cv', { field: 'nav:cv' })}>{w.nav.cv}</span></a>}
        {show(w.nav.email) && <a href={mailto} className="nav-gap"><span {...el('nav-email', { field: 'nav:email' })}>{w.nav.email}</span></a>}
        {site.instagram && show(w.nav.instagram) && <a href={site.instagram} target="_blank" rel="noreferrer"><span {...el('nav-instagram', { field: 'nav:instagram' })}>{w.nav.instagram}</span></a>}
        {site.linkedin && show(w.nav.linkedin) && <a href={site.linkedin} target="_blank" rel="noreferrer"><span {...el('nav-linkedin', { field: 'nav:linkedin' })}>{w.nav.linkedin}</span></a>}
      </nav>
      <button type="button" className="menu-button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d={open ? 'M6 6l12 12M18 6 6 18' : 'M3 7h18M3 12h18M3 17h18'} />
        </svg>
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Menu" className="menu-panel">
          {onPhone('nav-about', w.nav.about) && <PageLink to="/about/" onClick={done}>{w.nav.about}</PageLink>}
          {onPhone('nav-projects', w.nav.projects) && <PageLink to="/projects/" onClick={done}>{w.nav.projects}</PageLink>}
          {cvUrl && onPhone('nav-cv', w.nav.menu_cv) && <a href={cvUrl} download={cvFileName} onClick={done}>{w.nav.menu_cv}</a>}
          {onPhone('nav-email', w.nav.email) && <a href={mailto} className="menu-sep" onClick={done}>{w.nav.email}</a>}
          {site.instagram && onPhone('nav-instagram', w.nav.instagram) && <a href={site.instagram} target="_blank" rel="noreferrer" onClick={done}>{w.nav.instagram}</a>}
          {site.linkedin && onPhone('nav-linkedin', w.nav.linkedin) && <a href={site.linkedin} target="_blank" rel="noreferrer" onClick={done}>{w.nav.linkedin}</a>}
        </nav>
      )}
    </header>
  )
}
