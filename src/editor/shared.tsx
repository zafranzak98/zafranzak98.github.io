import { memo, useMemo, type ReactNode } from 'react'
import Footer from '#/components/footer'
import Header from '#/components/header'
import { Editing } from '#/layout/elements'
import { sharedElements } from '#/lib/page-layouts'
import { SharedWords, footerWords, headerWords, type FooterWords, type HeaderWords } from '#/lib/page-words'
import { applyEdits, type Edits } from './elements'

// The header and footer are shared: one copy, shown on every page. On any other page they are
// drawn as they are published, cannot be changed there, and a click opens them in the page list.
// (Demo: "published" means published in this browser.)

// The one list of real addresses: everywhere else the editor is a demo (no sign-in, nothing saved to GitHub).
export const SIGN_IN_HOSTS = ['zafranzak98.github.io', 'zafranzakaria.com']
export const UVE_DEMO = !SIGN_IN_HOSTS.includes(location.hostname)

export const SHARED_KEY = (part: 'header' | 'footer') => `uve-demo:shared:${part}`
export const sharedEdits = (part: 'header' | 'footer'): Edits => { if (!UVE_DEMO) return {}; try { return JSON.parse(localStorage.getItem(SHARED_KEY(part)) ?? '{}') as Edits } catch { return {} } }
// The shared words as published, worked out once and kept until they are published again, so the
// header and footer around the page are not redrawn on every change in the editor.
let published: { header?: HeaderWords; footer?: FooterWords } = {}
export const publishShared = (part: 'header' | 'footer', edits: Edits) => {
  published = {}
  try { localStorage.setItem(SHARED_KEY(part), JSON.stringify(edits)) } catch { /* kept until the tab closes */ }
}
export const publishedHeader = (): HeaderWords => (published.header ??= applyEdits(headerWords() as never, sharedEdits('header')) as unknown as HeaderWords)
export const publishedFooter = (): FooterWords => (published.footer ??= applyEdits(footerWords() as never, sharedEdits('footer')) as unknown as FooterWords)

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
  const words = useMemo(() => ({ header: header ?? publishedHeader(), footer: footer ?? publishedFooter() }), [header, footer])
  return (
    <SharedWords.Provider value={words}>
      <div className="page" id="top">
        {editing === 'header' ? null : <SharedHeader />}
        {children}
        {editing === 'footer' ? null : <SharedFooter />}
      </div>
    </SharedWords.Provider>
  )
}
// Drawn again only when the shared words change, not with every change to the page between them.
const SharedHeader = memo(() => <Editing.Provider value={false}><SharedPart part="header"><Header elements={sharedElements('header')} /></SharedPart></Editing.Provider>)
const SharedFooter = memo(() => <Editing.Provider value={false}><SharedPart part="footer"><Footer elements={sharedElements('footer')} /></SharedPart></Editing.Provider>)
