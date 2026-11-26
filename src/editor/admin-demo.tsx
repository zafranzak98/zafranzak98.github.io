import { useState } from 'react'

// Demo only: a copy of the website editor (/admin) as it would look with the visual editor added
// as one more entry. The forms (Projects, Categories, About and site settings, Media) stay exactly
// as they are today and are not part of this demo, so they are shown but cannot be opened here.

const FORMS = ['Projects', 'Categories', 'About and site settings']

// The menu can be hidden so the visual editor gets the full width (as in Wix). On screens narrower than
// 1500 px it starts hidden, so the editor keeps the 1280 px it needs for its one-row toolbar; the choice
// is remembered.
const MENU_KEY = 'uve-demo:admin-menu'
const menuStart = () => { try { const v = localStorage.getItem(MENU_KEY); return v ? v === 'open' : window.innerWidth >= 1500 } catch { return window.innerWidth >= 1500 } }

export function AdminShell() {
  const [note, setNote] = useState('')
  const [menu, setMenu] = useState(menuStart)
  const toggleMenu = () => { const next = !menu; setMenu(next); try { localStorage.setItem(MENU_KEY, next ? 'open' : 'closed') } catch { /* kept until the page reloads */ } }
  const formNote = (name: string) => () => setNote(`${name} opens the same form as today. The forms are not part of this demo; nothing in them changes.`)
  return (
    <div className="adm">
      <header className="adm-top">
        <button type="button" className="adm-menu-btn" aria-expanded={menu} aria-controls="adm-side" onClick={toggleMenu}>{menu ? 'Hide menu' : 'Menu'}</button>
        <span className="adm-site">Zafran Zakaria · Website editor</span>
        <span className="adm-chip">Demo copy of /admin. Nothing here changes GitHub, /admin or either website.</span>
      </header>
      <div className="adm-body">
        <nav id="adm-side" className="adm-side" aria-label="Website editor" hidden={!menu}>
          <p className="adm-group">Content</p>
          {FORMS.map((f) => <button key={f} type="button" className="adm-item" onClick={formNote(f)}>{f}<small>form, as today</small></button>)}
          <p className="adm-group">Media</p>
          <button type="button" className="adm-item" onClick={formNote('Media')}>Media library<small>as today</small></button>
          <p className="adm-group">Design</p>
          <button type="button" className="adm-item is-current" aria-current="page">Visual editor<small>every page, one editor</small></button>
          {note && <p className="adm-note" role="status">{note}</p>}
        </nav>
        <main className="adm-main">
          <iframe title="Visual editor" src="?page=home" className="adm-frame" />
        </main>
      </div>
    </div>
  )
}
