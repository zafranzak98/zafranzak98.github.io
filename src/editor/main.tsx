import { createRoot } from 'react-dom/client'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Puck, blocksPlugin, createUsePuck, fieldsPlugin, outlinePlugin, type Data } from '@puckeditor/core'
import '@puckeditor/core/no-external.css'
import '@fontsource-variable/instrument-sans/wdth.css'
import '../styles.css'
import './editor.css'
import { caseStudies, type Project } from '#/lib/site'
import { savedLayoutFor, standardCaseLayout } from '#/layout/render'
import { editorConfig, layoutWarnings } from './config'
import * as github from './github'
import { CATEGORY_FIELD, Selection, SelectionProvider, categoryEdits, nameOf, wordsOf, type Edits } from './elements'
import { categoryName } from '#/lib/site'
import { checkPage, type Finding } from './checks'
import { ContextBar } from './panel'
import { EyeIcon, LayersIcon, PlusIcon, RedoIcon, SlidersIcon, UndoIcon } from './icons'

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
const session = { get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }, set: (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* sign-in lasts until the page closes */ } }, remove: (k: string) => { try { sessionStorage.removeItem(k) } catch { /* nothing kept */ } } }

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
  const [notice, setNoticeState] = useState<Notice>(start.restored ? { text: 'Your unsaved changes from last time are back. Undo removes them one by one, or choose More, then "Discard unsaved changes".' } : { text: '' })
  const setNotice = (text: string, undo = false) => setNoticeState({ text, undo })
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const actions = useMemo(() => ({ p, token, setToken, setNotice, notice, markClean: () => { clean.current = '' }, clean }), [p, token, notice])
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
          { width: 1280, label: 'Small desktop', icon: 'Monitor' },
          { width: 1440, label: 'Desktop', icon: 'Monitor' },
          { width: 1920, label: 'Large desktop', icon: 'Monitor' },
        ]}
        overrides={OVERRIDES}
        plugins={PLUGINS}
        ui={{ leftSideBarVisible: false, rightSideBarVisible: false }}
        onAction={(action) => { if (action.type === 'remove') setNotice('Section removed from the page.', true) }}
      />
      </SelectionProvider>
    </SessionContext.Provider>
  )
}

type Notice = { text: string; undo?: boolean }
type Session = { p: Project; token: string | null; setToken: (t: string | null) => void; setNotice: (n: string, undo?: boolean) => void; notice: Notice; markClean: () => void; clean: { current: string | null } }

// The left-hand tools, named for what they do.
const PLUGINS = [{ ...blocksPlugin(), label: 'Add section', icon: <PlusIcon /> }, { ...outlinePlugin(), label: 'Page navigator', icon: <LayersIcon /> }, { ...fieldsPlugin(), label: 'Settings', icon: <SlidersIcon /> }]

const SessionContext = createContext<Session | null>(null)
const OVERRIDES = { header: () => <Actions />, fields: SidePanel }

// The right-hand panel: the selected element's settings; or the section's parts, its own content
// and its design settings; or, with nothing selected, how to get started.
function SidePanel({ fields }: { children: React.ReactNode; fields: Partial<Record<string, React.ReactNode>> }) {
  const { selected } = useContext(Selection)
  const item = usePuck((s) => s.selectedItem)
  const dispatch = usePuck((s) => s.dispatch)
  if (!item) {
    return (
      <div className="el-panel el-welcome">
        <h2>Page settings</h2>
        <p className="el-note">Select something on the page to see all its settings here.</p>
        <button type="button" onClick={() => dispatch({ type: 'setUi', ui: { leftSideBarVisible: true } })}>Add or rearrange sections</button>
      </div>
    )
  }
  const { elements, design, ...content } = fields
  if (selected && selected.blockId === item.props.id && elements) return <>{elements}</>
  return (
    <>
      {elements}
      {Object.values(content)}
      {design && <details className="el-section-design"><summary>Section design (background, spacing, width)</summary>{design}</details>}
    </>
  )
}

const SCREENS_BAR: [string, number][] = [['Desktop', 1440], ['Tablet', 1024], ['Phone', 390]]
const DESKTOP_WIDTHS = [1280, 1440, 1920]
const time = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

// The top bar: the project, the screen size being edited, undo and redo, where the work stands,
// and the three steps that matter: preview, save a draft, publish.
function Actions() {
  const { p, token, setToken, setNotice, notice, markClean, clean } = useContext(SessionContext)!
  const data = usePuck((s) => s.appState.data)
  const history = usePuck((s) => s.history)
  const [saved, setSaved] = useState<{ json: string; text: string } | null>(null)
  const [preview, setPreview] = useState(false)
  const { select } = useContext(Selection)
  useEffect(() => { if (clean.current === '') clean.current = JSON.stringify(data) }, [data, clean])
  const dispatch = usePuck((s) => s.dispatch)
  const [busy, setBusy] = useState('')
  const [panel, setPanel] = useState<'' | 'publish' | 'history' | 'reset'>('')
  const ui = usePuck((s) => s.appState.ui)
  const [findings, setFindings] = useState<Finding[] | null>(null)

  // Before publishing, the page is checked at each screen size, then the preview goes back to where it was.
  const openPublish = async () => {
    setPanel('publish')
    setFindings(null)
    const found: Finding[] = []
    for (const [screen, width] of [['Desktop', 1440], ['Tablet', 1024], ['Phone', 390]] as const) {
      dispatch({ type: 'setUi', ui: { viewports: { ...ui.viewports, current: { width, height: 'auto' } } } })
      await new Promise((r) => setTimeout(r, 700))
      const doc = (document.getElementById('preview-frame') as HTMLIFrameElement | null)?.contentDocument
      if (doc) found.push(...checkPage(doc, screen, nameOf))
    }
    dispatch({ type: 'setUi', ui: { viewports: ui.viewports } })
    setFindings(found)
  }
  const [versions, setVersions] = useState<Version[]>([])
  const [more, setMore] = useState(false)
  const choose = (action: () => void) => () => { setMore(false); action() }
  const warnings = layoutWarnings(data.content as never)
  const renames = categoryEdits(((data.root.props as { edits?: Edits } | undefined)?.edits) ?? {}).map(([field, to]) => [field.match(CATEGORY_FIELD)![1], to] as const)
  const json = JSON.stringify(data)
  const unsaved = clean.current !== '' && json !== clean.current && json !== saved?.json
  const status = saved && json === saved.json ? saved.text : unsaved ? 'Unsaved changes' : 'No unsaved changes'
  const showWidth = (width: number) => dispatch({ type: 'setUi', ui: { viewports: { ...ui.viewports, current: { width, height: 'auto' } } } })
  // Preview hides every editing mark and panel, so the page looks exactly as visitors see it.
  const before = useRef<{ left: boolean; right: boolean } | null>(null)
  const togglePreview = () => {
    const doc = (document.getElementById('preview-frame') as HTMLIFrameElement | null)?.contentDocument
    if (!preview) {
      before.current = { left: ui.leftSideBarVisible, right: ui.rightSideBarVisible }
      dispatch({ type: 'setUi', ui: { leftSideBarVisible: false, rightSideBarVisible: false, itemSelector: null } })
      doc?.documentElement.setAttribute('data-preview', '')
      document.body.classList.add('is-preview')
      select(null)
    } else {
      dispatch({ type: 'setUi', ui: { leftSideBarVisible: before.current?.left ?? false, rightSideBarVisible: before.current?.right ?? false } })
      doc?.documentElement.removeAttribute('data-preview')
      document.body.classList.remove('is-preview')
    }
    setPreview(!preview)
  }

  const run = async (label: string, task: () => Promise<string>) => {
    setBusy(label)
    try { setNotice(await task()) } catch (e) {
      const message = (e as Error).message
      // An expired or withdrawn sign-in: forget it, so "Sign in with GitHub" shows again.
      if (/\b401\b|Bad credentials/i.test(message)) {
        session.remove('design-editor:token')
        setToken(null)
        setNotice(`${label} did not work because your sign-in has expired. Choose "Sign in with GitHub", then try again. Nothing was changed.`)
      } else setNotice(`${label} did not work: ${message} Nothing was changed.`)
    } finally { setBusy('') }
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
    if (DEMO) { writeLocal(localKey(p.slug, 'draft'), data); setSaved({ json: JSON.stringify(data), text: `Draft saved at ${time()}` }); return `Draft saved in this browser (${stamp()}). In the real editor it is saved to the drafts branch; nothing is published.` }
    await github.writeLayout(needToken(), p.slug, data, github.DRAFTS, `Design editor: draft for ${p.slug}`)
    setSaved({ json: JSON.stringify(data), text: `Draft saved at ${time()}` })
    return `Draft saved (${stamp()}). Nothing is published until you choose Publish.`
  })

  const publish = () => run('Publishing', async () => {
    setPanel('')
    if (DEMO) {
      const list = readLocal<Version[]>(localKey(p.slug, 'versions'), [])
      writeLocal(localKey(p.slug, 'versions'), [{ id: String(Date.now()), date: new Date().toISOString(), message: 'Published (demo)', layout: data }, ...list].slice(0, 30))
      removeLocal(localKey(p.slug, 'unsaved'))
      clean.current = JSON.stringify(data)
      setSaved({ json: clean.current, text: `Published at ${time()}` })
      return 'Published in this demo only. In the real editor this saves the page and the test site updates in about a minute, after the usual checks.'
    }
    // Words, shared category names and the layout are saved together, all or nothing.
    const edits = (data.root.props as { edits?: Edits } | undefined)?.edits ?? {}
    const pageWords = Object.fromEntries(Object.entries(edits).filter(([field]) => !CATEGORY_FIELD.test(field)))
    const { edits: _words, ...rootProps } = (data.root.props ?? {}) as { edits?: Edits }
    const layout = { ...data, root: { ...data.root, props: rootProps } }
    const standard = JSON.stringify(data.content) === JSON.stringify(standardCaseLayout().content)
    const changes: github.Change[] = [
      ...(Object.keys(pageWords).length ? [{ path: `content/projects/${p.slug}.md`, edits: pageWords, startedWith: (field: string) => wordsOf(p, field) }] : []),
      ...categoryEdits(edits).map(([field, words]) => {
        const slug = field.match(CATEGORY_FIELD)![1]
        return { path: `content/categories/${slug}.md`, edits: { name: words }, startedWith: () => categoryName(slug), label: `the "${categoryName(slug)}" category name` }
      }),
      { path: github.layoutPath(p.slug), text: standard ? null : `${JSON.stringify(layout, null, 2)}\n` },
    ]
    await github.publishTogether(needToken(), changes, `Design editor: publish ${p.slug}`)
    removeLocal(localKey(p.slug, 'unsaved'))
    clean.current = JSON.stringify(data)
    setSaved({ json: clean.current, text: `Published at ${time()}` })
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
    <header className="editor-bar">
      <div className="editor-bar-start">
        <span className="editor-brand">Design editor</span>
        {DEMO && <span className="editor-chip" title="Everything works, but saving and publishing stay in this browser.">Demo</span>}
        <label className="editor-field"><span className="sr-only">Project</span>
          <select className="editor-project" value={p.slug} onChange={(e) => { location.search = `?project=${e.target.value}` }}>
            {caseStudies.map((x) => <option key={x.slug} value={x.slug}>{x.title}</option>)}
          </select>
        </label>
      </div>

      <div className="editor-bar-middle" role="group" aria-label="Screen size you are editing">
        <div className="editor-screens">
          {SCREENS_BAR.map(([name, width]) => {
            const current = Number(ui.viewports.current.width)
            const on = name === 'Desktop' ? current >= 1280 : name === 'Tablet' ? current >= 900 && current < 1280 : current < 900
            return <button key={name} type="button" aria-pressed={on} onClick={() => showWidth(width)}>{name}</button>
          })}
        </div>
        {Number(ui.viewports.current.width) >= 1280 && (
          <label className="editor-field editor-width"><span className="sr-only">Desktop width</span>
            <select value={Number(ui.viewports.current.width)} onChange={(e) => showWidth(Number(e.target.value))}>
              {DESKTOP_WIDTHS.map((w) => <option key={w} value={w}>{w} px wide</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="editor-bar-end">
        <div className="editor-history">
          <button type="button" onClick={history.back} disabled={!history.hasPast} title="Undo (Cmd+Z)" aria-label="Undo"><UndoIcon /><span className="editor-word">Undo</span></button>
          <button type="button" onClick={history.forward} disabled={!history.hasFuture} title="Redo (Cmd+Shift+Z)" aria-label="Redo"><RedoIcon /><span className="editor-word">Redo</span></button>
        </div>
        <span className={`editor-status${unsaved ? ' is-unsaved' : ''}`} role="status" title={unsaved ? 'Kept safely in this browser. Save a draft or publish when ready.' : undefined}>{busy ? `${busy}…` : status}</span>
        <button type="button" className="editor-quiet editor-preview" aria-pressed={preview} onClick={togglePreview}><EyeIcon /><span>{preview ? 'Back to editing' : 'Preview'}</span></button>
        <div className="editor-more-wrap">
          <button type="button" className="editor-quiet" aria-expanded={more} aria-haspopup="true" onClick={() => setMore(!more)}>More <span aria-hidden="true">▾</span></button>
          <div className={more ? 'editor-more open' : 'editor-more'}>
            <button type="button" onClick={choose(openHistory)} disabled={!!busy}>Versions <small>bring back an earlier version</small></button>
            <button type="button" onClick={choose(discardUnsaved)} disabled={!!busy || !unsaved}>Discard unsaved changes <small>go back to the published page</small></button>
            <button type="button" onClick={choose(() => setPanel('reset'))} disabled={!!busy}>Standard layout <small>start again from the template</small></button>
          </div>
        </div>
        {!DEMO && !token && <button type="button" className="editor-signin" onClick={signIn} disabled={!!busy}>Sign in</button>}
        <button type="button" className="editor-save" onClick={saveDraft} disabled={!!busy} title="Saves without changing the website">Save<span className="editor-long"> draft</span></button>
        <button type="button" className="editor-primary" onClick={openPublish} disabled={!!busy} title="Checks the page, then updates the website">Publish</button>
      </div>
      <div className="editor-bar-ctx">{preview ? <p className="ctx ctx-hint">Previewing the page exactly as visitors see it. Nothing here can be changed until you go back to editing.</p> : <ContextBar />}</div>
      {warnings.length > 0 && <p className="editor-demo editor-checks">{warnings.join(' ')}</p>}
      {notice.text && (
        <div className="editor-notice" role="status">
          <p>{notice.text}</p>
          {notice.undo && <button type="button" onClick={() => { history.back(); setNotice('') }}>Undo</button>}
          <button type="button" onClick={() => setNotice('')}>Close</button>
        </div>
      )}

      {panel === 'publish' && (
        <Panel title="Publish this page?" onClose={() => setPanel('')}>
          <p>The test site will show this layout for {p.title} in about a minute, after the usual checks. The current version stays in Versions, so you can bring it back at any time.</p>
          {renames.length > 0 && (
            <div className="editor-impact" role="note">
              <p><b>This also changes other pages.</b> These shared names will change on every project page, the Projects page and the filters:</p>
              <ul>{renames.map(([slug, to]) => <li key={slug}>{categoryName(slug)} → {to}</li>)}</ul>
            </div>
          )}
          {warnings.map((w) => <p key={w} className="editor-warning-text">{w}</p>)}
          {findings === null ? (
            <p role="status">Checking Desktop, Tablet and Phone…</p>
          ) : findings.length ? (
            <>
              <p>Worth a look before publishing (it can still be published):</p>
              <ul className="editor-findings">{findings.map((f) => <li key={`${f.screen}${f.text}`}><b>{f.screen}:</b> {f.text}</li>)}</ul>
            </>
          ) : (
            <p role="status">Checked on Desktop, Tablet and Phone: nothing overlaps, runs off the screen, is too small or is hard to read.</p>
          )}
          <button type="button" className="editor-primary" onClick={publish} disabled={findings === null}>{findings?.length ? 'Publish anyway' : 'Publish'}</button>
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
    </header>
  )
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    // The first usable button, or the dialog itself while a button is still waiting (checks running).
    ;(ref.current?.querySelector<HTMLElement>('button:not(:disabled)') ?? ref.current)?.focus()
    return () => opener?.focus()
  }, [])
  return (
    <div ref={ref} tabIndex={-1} className="editor-panel" role="dialog" aria-label={title} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
      <h2>{title}</h2>
      {children}
      <button type="button" onClick={onClose}>Cancel</button>
    </div>
  )
}

createRoot(document.getElementById('editor')!).render(<EditorApp />)
