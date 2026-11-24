import type { ReactNode } from 'react'
import Footer from '#/components/footer'
import Header from '#/components/header'
import { Editing } from '#/layout/elements'
import { SharedWords, footerWords, headerWords, type FooterWords, type HeaderWords } from '#/lib/page-words'
import { applyEdits, type Edits } from './elements'

// The header and footer are shared: one copy, shown on every page. On any other page they are
// drawn as they are published, cannot be changed there, and a click opens them in the page list.
// (Demo: "published" means published in this browser.)

// The visual editor demo runs on any address other than the website itself; the published editor
// at /admin/design stays exactly as F-22 Ver.1 (no shared parts in its canvas).
export const UVE_DEMO = !['zafranzak98.github.io', 'zafranzakaria.com'].includes(location.hostname)

export const SHARED_KEY = (part: 'header' | 'footer') => `uve-demo:shared:${part}`
export const sharedEdits = (part: 'header' | 'footer'): Edits => { try { return JSON.parse(localStorage.getItem(SHARED_KEY(part)) ?? '{}') as Edits } catch { return {} } }
export const publishShared = (part: 'header' | 'footer', edits: Edits) => { try { localStorage.setItem(SHARED_KEY(part), JSON.stringify(edits)) } catch { /* kept until the tab closes */ } }
export const publishedHeader = (): HeaderWords => applyEdits(headerWords() as never, sharedEdits('header')) as unknown as HeaderWords
export const publishedFooter = (): FooterWords => applyEdits(footerWords() as never, sharedEdits('footer')) as unknown as FooterWords

function SharedPart({ part, children }: { part: 'header' | 'footer'; children: ReactNode }) {
  const open = () => { window.parent.location.search = `?page=${part}` }
  // Its links do not leave the editor.
  const stay = (e: React.MouseEvent) => { if ((e.target as Element).closest('a')) e.preventDefault() }
  return (
    <div className={`shared-part shared-${part}`} data-shared={part} onClickCapture={stay}>
      {children}
      <button type="button" className="shared-tag" onClick={open} onPointerDown={(e) => e.stopPropagation()}>
        Shared {part === 'header' ? 'header' : 'footer'} · on every page · Edit
      </button>
    </div>
  )
}

// A page in the canvas with the shared parts around it, as visitors see it.
export function SharedAround({ children, header, footer, editing }: { children: ReactNode; header?: HeaderWords; footer?: FooterWords; editing?: 'header' | 'footer' }) {
  return (
    <SharedWords.Provider value={{ header: header ?? publishedHeader(), footer: footer ?? publishedFooter() }}>
      <div className="page" id="top">
        {editing === 'header' ? null : <Editing.Provider value={false}><SharedPart part="header"><Header /></SharedPart></Editing.Provider>}
        {children}
        {editing === 'footer' ? null : <Editing.Provider value={false}><SharedPart part="footer"><Footer /></SharedPart></Editing.Provider>}
      </div>
    </SharedWords.Provider>
  )
}
