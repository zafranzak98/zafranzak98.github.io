import { createRoot } from 'react-dom/client'
import { useMemo, useRef, useState } from 'react'
import { Puck, createUsePuck, type Data } from '@puckeditor/core'
import '@puckeditor/core/no-external.css'
import '@fontsource-variable/instrument-sans/wdth.css'
import '../styles.css'
import './editor.css'
import { caseStudies, type Project } from '#/lib/site'
import { savedLayoutFor, standardCaseLayout } from '#/layout/render'
import { editorConfig, layoutWarnings } from './config'
import * as github from './github'

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

function startingLayout(p: Project): { data: Data; restored: boolean } {
  const unsaved = readLocal<Data | null>(localKey(p.slug, 'unsaved'), null)
  if (unsaved) return { data: unsaved, restored: true }
  return { data: (savedLayoutFor(p) ?? standardCaseLayout()) as Data, restored: false }
}

function EditorApp() {
  const params = new URLSearchParams(location.search)
  const p = caseStudies.find((x) => x.slug === params.get('project')) ?? caseStudies.find((x) => x.design === 'about-face') ?? caseStudies[0]
  const config = useMemo(() => editorConfig(p), [p])
  const [start] = useState(() => startingLayout(p))
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('design-editor:token'))
  const [notice, setNotice] = useState<string>(start.restored ? 'Your unsaved changes from last time are back. Use Undo, or "Discard unsaved changes", to drop them.' : '')
  const saveTimer = useRef<number>(undefined)

  // Keep unsaved work in this browser, a moment after each change.
  const onChange = (data: Data) => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => writeLocal(localKey(p.slug, 'unsaved'), data), 400)
  }

  const session = { p, token, setToken, setNotice }
  return (
    <>
      <Puck
        config={config}
        data={start.data}
        onChange={onChange}
        headerTitle={`Design editor · ${p.title}`}
        viewports={[
          { width: 390, label: 'Phone', icon: 'Smartphone' },
          { width: 1024, label: 'Tablet', icon: 'Tablet' },
          { width: 1440, label: 'Desktop', icon: 'Monitor' },
        ]}
        overrides={{ headerActions: () => <Actions {...session} /> }}
      />
      {notice && <div className="editor-notice" role="status"><p>{notice}</p><button type="button" onClick={() => setNotice('')}>Close</button></div>}
    </>
  )
}

type Session = { p: Project; token: string | null; setToken: (t: string | null) => void; setNotice: (n: string) => void }

function Actions({ p, token, setToken, setNotice }: Session) {
  const data = usePuck((s) => s.appState.data)
  const dispatch = usePuck((s) => s.dispatch)
  const [busy, setBusy] = useState('')
  const [panel, setPanel] = useState<'' | 'publish' | 'history' | 'reset'>('')
  const [versions, setVersions] = useState<Version[]>([])
  const warnings = layoutWarnings(data.content as never)

  const run = async (label: string, task: () => Promise<string>) => {
    setBusy(label)
    try { setNotice(await task()) } catch (e) { setNotice(`${label} did not work: ${(e as Error).message} Nothing was changed.`) } finally { setBusy('') }
  }
  const needToken = () => { if (!token) throw new Error('Sign in first.'); return token }
  const stamp = () => new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  const signIn = () => run('Sign-in', async () => {
    const t = await github.signIn()
    sessionStorage.setItem('design-editor:token', t)
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
      localStorage.removeItem(localKey(p.slug, 'unsaved'))
      return 'Published in this demo only. In the real editor this saves the page and the test site updates in about a minute, after the usual checks.'
    }
    await github.writeLayout(needToken(), p.slug, data, github.MAIN, `Design editor: publish layout for ${p.slug}`)
    localStorage.removeItem(localKey(p.slug, 'unsaved'))
    return 'Published. The test site updates in about a minute, after the usual checks. If a check fails, the site stays as it was and you get the usual email.'
  })

  const openHistory = () => run('Loading history', async () => {
    setPanel('history')
    if (DEMO) { setVersions(readLocal<Version[]>(localKey(p.slug, 'versions'), [])); return '' }
    setVersions((await github.history(needToken(), p.slug)).map((v: { sha: string; date: string; message: string }) => ({ id: v.sha, date: v.date, message: v.message })))
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
    localStorage.removeItem(localKey(p.slug, 'unsaved'))
    dispatch({ type: 'setData', data: (savedLayoutFor(p) ?? standardCaseLayout()) as Data })
    setNotice('Unsaved changes discarded. The page is as last published.')
  }

  return (
    <div className="editor-actions">
      {warnings.length > 0 && <span className="editor-flag" title={warnings.join(' ')}>{warnings.length} check{warnings.length > 1 ? 's' : ''} to look at</span>}
      {DEMO ? <span className="editor-flag">Demo: saves in this browser only</span> : !token && <button type="button" onClick={signIn} disabled={!!busy}>Sign in with GitHub</button>}
      <button type="button" onClick={discardUnsaved} disabled={!!busy}>Discard unsaved changes</button>
      <button type="button" onClick={openHistory} disabled={!!busy}>Versions</button>
      <button type="button" onClick={() => setPanel('reset')} disabled={!!busy}>Standard layout</button>
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
        <Panel title="Published versions" onClose={() => setPanel('')}>
          {versions.length ? (
            <ul className="editor-versions">
              {versions.map((v) => (
                <li key={v.id}>
                  <span>{new Date(v.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <button type="button" onClick={() => loadVersion(v)}>Load into editor</button>
                </li>
              ))}
            </ul>
          ) : <p>No published versions yet: the page uses the standard layout.</p>}
        </Panel>
      )}
    </div>
  )
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="editor-panel" role="dialog" aria-label={title}>
      <h2>{title}</h2>
      {children}
      <button type="button" onClick={onClose}>Cancel</button>
    </div>
  )
}

createRoot(document.getElementById('editor')!).render(<EditorApp />)
