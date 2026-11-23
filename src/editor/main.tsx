import { createRoot } from 'react-dom/client'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Puck, createUsePuck, type Data } from '@puckeditor/core'
import '@puckeditor/core/no-external.css'
import '@fontsource-variable/instrument-sans/wdth.css'
import '../styles.css'
import './editor.css'
import { caseStudies, type Project } from '#/lib/site'
import { savedLayoutFor, standardCaseLayout } from '#/layout/render'
import { editorConfig, layoutWarnings } from './config'
import * as github from './github'
import { SelectionProvider, wordsOf, type Edits } from './elements'

// The design editor at /admin/design/. Arrange and restyle a page with its real blocks, then
// save a draft or publish. Undo and redo cover every change; unsaved work is kept in this
// browser, so closing the tab loses nothing.
//
// On any other address (a preview copy) the editor runs as a demo: everything works except
// signing in, and drafts and versions are kept in this browser only.

const SIGN_IN_HOSTS = ['zafranzak98.github.io', 'zafranzakaria.com']
const DEMO = !SIGN_IN_HOSTS.includes(location.hostname)
const usePuck = createUsePuck()

const localKey = (slug: string, kind: string) => `design-editor:${slug}:${kind}`
type Version = { id: string; date: string; message: string; layout?: Data }
const readLocal = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) ?? '') as T } catch { return fallback } }
const writeLocal = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or blocked: work continues */ } }
const removeLocal = (key: string) => { try { localStorage.removeItem(key) } catch { /* nothing to remove */ } }
const session = { get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }, set: (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* sign-in lasts until the page closes */ } } }

function startingLayout(p: Project): { data: Data; restored: boolean } {
  const unsaved = readLocal<Data | null>(localKey(p.slug, 'unsaved'), null)
  if (unsaved) return { data: unsaved, restored: true }
  return { data: (savedLayoutFor(p) ?? standardCaseLayout()) as Data, restored: false }
}

// Puck leaves a few of its own controls unnamed; name them for screen readers as they appear.
function labelPuckControls() {
  const fix = () => {
    document.getElementById('preview-frame')?.setAttribute('title', 'Page preview')
    document.querySelector('[class*="ViewportControls-zoomSelect"]')?.setAttribute('aria-label', 'Zoom')
    document.querySelectorAll('[class*="_Loader_"][aria-label]').forEach((e) => e.setAttribute('role', 'status'))
  }
  fix()
  const watch = new MutationObserver(fix)
  watch.observe(document.body, { childList: true, subtree: true })
  return () => watch.disconnect()
}

function EditorApp() {
  const params = new URLSearchParams(location.search)
  const p = caseStudies.find((x) => x.slug === params.get('project')) ?? caseStudies.find((x) => x.design === 'about-face') ?? caseStudies[0]
  const config = useMemo(() => editorConfig(p), [p])
  const [start] = useState(() => startingLayout(p))
  const [token, setToken] = useState<string | null>(() => session.get('design-editor:token'))
  const [notice, setNotice] = useState<string>(start.restored ? 'Your unsaved changes from last time are back. Use Undo, or "Discard unsaved changes", to drop them.' : '')
  const saveTimer = useRef<number>(undefined)
  // The page as published, in the form the editor holds it; matching it means nothing is unsaved.
  // '' means "take the next state the editor shows as the published one".
  const clean = useRef<string | null>(start.restored ? null : '')

  // Keep unsaved work in this browser, a moment after each change.
  const onChange = (data: Data) => {
    window.clearTimeout(saveTimer.current)
    const json = JSON.stringify(data)
    saveTimer.current = window.setTimeout(() => {
      if (json === clean.current) removeLocal(localKey(p.slug, 'unsaved'))
      else writeLocal(localKey(p.slug, 'unsaved'), data)
    }, 400)
  }

  useEffect(labelPuckControls, [])

  const actions = useMemo(() => ({ p, token, setToken, setNotice, markClean: () => { clean.current = '' }, clean }), [p, token])
  return (
    <SessionContext.Provider value={actions}>
      <SelectionProvider>
      <Puck
        config={config}
        data={start.data}
        onChange={onChange}
        headerTitle="Design editor"
        viewports={[
          { width: 390, label: 'Phone', icon: 'Smartphone' },
          { width: 1024, label: 'Tablet', icon: 'Tablet' },
          { width: 1440, label: 'Desktop', icon: 'Monitor' },
        ]}
        overrides={OVERRIDES}
      />
      {notice && <div className="editor-notice" role="status"><p>{notice}</p><button type="button" onClick={() => setNotice('')}>Close</button></div>}
      </SelectionProvider>
    </SessionContext.Provider>
  )
}

type Session = { p: Project; token: string | null; setToken: (t: string | null) => void; setNotice: (n: string) => void; markClean: () => void; clean: { current: string | null } }

const SessionContext = createContext<Session | null>(null)
const OVERRIDES = { headerActions: () => <Actions /> }

function Actions() {
  const { p, token, setToken, setNotice, markClean, clean } = useContext(SessionContext)!
  const data = usePuck((s) => s.appState.data)
  useEffect(() => { if (clean.current === '') clean.current = JSON.stringify(data) }, [data, clean])
  const dispatch = usePuck((s) => s.dispatch)
  const [busy, setBusy] = useState('')
  const [panel, setPanel] = useState<'' | 'publish' | 'history' | 'reset'>('')
  const [versions, setVersions] = useState<Version[]>([])
  const [more, setMore] = useState(false)
  const choose = (action: () => void) => () => { setMore(false); action() }
  const warnings = layoutWarnings(data.content as never)

  const run = async (label: string, task: () => Promise<string>) => {
    setBusy(label)
    try { setNotice(await task()) } catch (e) { setNotice(`${label} did not work: ${(e as Error).message} Nothing was changed.`) } finally { setBusy('') }
  }
  const needToken = () => { if (!token) throw new Error('Sign in first.'); return token }
  const stamp = () => new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  const signIn = () => run('Sign-in', async () => {
    const t = await github.signIn()
    session.set('design-editor:token', t)
    setToken(t)
    return 'Signed in. Drafts and publishing now save to the website.'
  })

  const saveDraft = () => run('Saving the draft', async () => {
    if (DEMO) { writeLocal(localKey(p.slug, 'draft'), data); return `Draft saved in this browser (${stamp()}). In the real editor it is saved to the drafts branch; nothing is published.` }
    await github.writeLayout(needToken(), p.slug, data, github.DRAFTS, `Design editor: draft for ${p.slug}`)
    return `Draft saved (${stamp()}). Nothing is published until you choose Publish.`
  })

  const publish = () => run('Publishing', async () => {
    setPanel('')
    if (DEMO) {
      const list = readLocal<Version[]>(localKey(p.slug, 'versions'), [])
      writeLocal(localKey(p.slug, 'versions'), [{ id: String(Date.now()), date: new Date().toISOString(), message: 'Published (demo)', layout: data }, ...list].slice(0, 30))
      removeLocal(localKey(p.slug, 'unsaved'))
      clean.current = JSON.stringify(data)
      return 'Published in this demo only. In the real editor this saves the page and the test site updates in about a minute, after the usual checks.'
    }
    const edits = (data.root.props as { edits?: Edits } | undefined)?.edits ?? {}
    if (Object.keys(edits).length) await github.writeWords(needToken(), p.slug, edits, (field) => wordsOf(p, field))
    const { edits: _words, ...rootProps } = (data.root.props ?? {}) as { edits?: Edits }
    const layout = { ...data, root: { ...data.root, props: rootProps } }
    const standard = JSON.stringify(data.content) === JSON.stringify(standardCaseLayout().content)
    if (standard) await github.removeLayout(needToken(), p.slug, `Design editor: back to the standard layout for ${p.slug}`)
    else await github.writeLayout(needToken(), p.slug, layout, github.MAIN, `Design editor: publish layout for ${p.slug}`)
    removeLocal(localKey(p.slug, 'unsaved'))
    clean.current = JSON.stringify(data)
    return 'Published. The test site updates in about a minute, after the usual checks. If a check fails, the site stays as it was and you get the usual email.'
  })

  const openHistory = () => run('Loading history', async () => {
    setPanel('history')
    if (DEMO) { setVersions(readLocal<Version[]>(localKey(p.slug, 'versions'), [])); return '' }
    const t = needToken()
    const [draft, published] = await Promise.all([github.latestDraft(t, p.slug), github.history(t, p.slug)])
    setVersions([...(draft ? [draft] : []), ...published].map((v: { sha: string; date: string; message: string }) => ({ id: v.sha, date: v.date, message: v.message })))
    return ''
  })

  const loadVersion = (v: Version) => run('Loading that version', async () => {
    const layout = DEMO ? v.layout : (await github.readLayout(needToken(), p.slug, v.id))?.layout
    if (!layout) throw new Error('That version has no layout (the standard layout was in use).')
    dispatch({ type: 'setData', data: layout as Data })
    setPanel('')
    return `Loaded the version from ${new Date(v.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. Nothing is published until you choose Publish; Undo takes you back.`
  })

  const loadStandard = () => {
    dispatch({ type: 'setData', data: standardCaseLayout() as Data })
    setPanel('')
    setNotice('The standard layout is loaded. Publish to use it on the website; Undo takes you back.')
  }

  const discardUnsaved = () => {
    removeLocal(localKey(p.slug, 'unsaved'))
    markClean()
    dispatch({ type: 'setData', data: (savedLayoutFor(p) ?? standardCaseLayout()) as Data })
    setNotice('Unsaved changes discarded. The page is as last published.')
  }

  return (
    <div className="editor-actions">
      <select className="editor-project" aria-label="Project to edit" value={p.slug} onChange={(e) => { location.search = `?project=${e.target.value}` }}>
        {caseStudies.map((x) => <option key={x.slug} value={x.slug}>{x.title}</option>)}
      </select>
      {warnings.length > 0 && <span className="editor-flag" title={warnings.join(' ')}>{warnings.length} check{warnings.length > 1 ? 's' : ''} to look at</span>}
      {DEMO ? <span className="editor-flag">Demo: saves in this browser only</span> : !token && <button type="button" onClick={signIn} disabled={!!busy}>Sign in with GitHub</button>}
      <button type="button" className="editor-more-toggle" aria-expanded={more} onClick={() => setMore(!more)}>More</button>
      <div className={more ? 'editor-more open' : 'editor-more'}>
        <button type="button" onClick={choose(openHistory)} disabled={!!busy}>Versions</button>
        <button type="button" onClick={choose(() => setPanel('reset'))} disabled={!!busy}>Standard layout</button>
        <button type="button" onClick={choose(discardUnsaved)} disabled={!!busy}>Discard unsaved changes</button>
      </div>
      <button type="button" onClick={saveDraft} disabled={!!busy}>Save draft</button>
      <button type="button" className="editor-primary" onClick={() => setPanel('publish')} disabled={!!busy}>Publish</button>
      {busy && <span className="editor-flag" role="status">{busy}…</span>}

      {panel === 'publish' && (
        <Panel title="Publish this page?" onClose={() => setPanel('')}>
          <p>The test site will show this layout for {p.title} in about a minute, after the usual checks. The current version stays in Versions, so you can bring it back at any time.</p>
          {warnings.map((w) => <p key={w} className="editor-warning-text">{w}</p>)}
          <button type="button" className="editor-primary" onClick={publish}>Publish</button>
        </Panel>
      )}
      {panel === 'reset' && (
        <Panel title="Load the standard layout?" onClose={() => setPanel('')}>
          <p>This loads the approved template for this project into the editor. Nothing changes on the website until you publish, and Undo takes you back.</p>
          <button type="button" onClick={loadStandard}>Load the standard layout</button>
        </Panel>
      )}
      {panel === 'history' && (
        <Panel title="Versions" onClose={() => setPanel('')}>
          {versions.length ? (
            <ul className="editor-versions">
              {versions.map((v) => (
                <li key={v.id}>
                  <span>{v.message === 'Latest draft' ? 'Draft' : 'Published'}, {new Date(v.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <button type="button" onClick={() => loadVersion(v)}>Load into editor</button>
                </li>
              ))}
            </ul>
          ) : <p>No saved versions yet: the page uses the standard layout.</p>}
        </Panel>
      )}
    </div>
  )
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.querySelector('button')?.focus()
    return () => opener?.focus()
  }, [])
  return (
    <div ref={ref} className="editor-panel" role="dialog" aria-label={title} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <h2>{title}</h2>
      {children}
      <button type="button" onClick={onClose}>Cancel</button>
    </div>
  )
}

createRoot(document.getElementById('editor')!).render(<EditorApp />)
