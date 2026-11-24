import { useState } from 'react'

// Demo only: a copy of the website editor (/admin) as it would look with the visual editor added
// as one more entry. The forms (Projects, Categories, About and site settings, Media) stay exactly
// as they are today and are not part of this demo, so they are shown but cannot be opened here.

const FORMS = ['Projects', 'Categories', 'About and site settings']

export function AdminShell() {
  const [note, setNote] = useState('')
  const formNote = (name: string) => () => setNote(`${name} opens the same form as today. The forms are not part of this demo; nothing in them changes.`)
  return (
    <div className="adm">
      <header className="adm-top">
        <span className="adm-site">Zafran Zakaria · Website editor</span>
        <span className="adm-chip">Demo copy of /admin. Nothing here changes GitHub, /admin or either website.</span>
      </header>
      <div className="adm-body">
        <nav className="adm-side" aria-label="Website editor">
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
