import { createRoot } from 'react-dom/client'
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Puck, createUsePuck, fieldsPlugin, type Data } from '@puckeditor/core'
import '@puckeditor/core/no-external.css'
import '@fontsource-variable/instrument-sans/wdth.css'
import '../styles.css'
import './editor.css'
import { caseStudies, type Project } from '#/lib/site'
import { savedLayoutFor, standardCaseLayout } from '#/layout/render'
import { editorConfig, layoutWarnings } from './config'
import * as github from './github'
import { SHARED_KEY, currentAccount, forgetOwn, keepOwn, sharedToken, signOutHere, type Account } from './signin'
import { CATEGORY_FIELD, Selection, SelectionProvider, categoryEdits, nameOf, wordsOf, type Edits } from './elements'
import { categoryName } from '#/lib/site'
import { checkPage, noteId, type Finding } from './checks'
import { describeStep } from './history'
import { LayoutNotes, checkOptions, settled, type Intended } from './notes'
import { ContextBar, screenFor } from './panel'
import { SectionsPanel, openSections } from './sections'
import { PhotoPicker, emptyImages, openPhotoPicker } from './photos'
import { EyeIcon, LayersIcon, RedoIcon, SlidersIcon, UndoIcon } from './icons'

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
// Returns false when the browser would not keep it (storage full or blocked); work continues.
const writeLocal = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false } }
const removeLocal = (key: string) => { try { localStorage.removeItem(key) } catch { /* nothing to remove */ } }

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
  // One sign-in shared with the website editor (see signin.ts); GitHub's refusal of a token is
  // remembered so it is not offered again until Sveltia renews it or you sign in.
  const refused = useRef<string | null>(null)
  const [account, setAccount] = useState<Account | null>(() => currentAccount())
  const [login, setLogin] = useState('')
  const token = account?.token ?? null
  const setToken = (t: string | null) => setAccount(t ? { token: t, shared: false } : currentAccount(refused.current))
  // Another tab (or /admin) signing in, renewing or signing out reaches this tab at once.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === SHARED_KEY) setAccount(currentAccount(refused.current)) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  // Check the sign-in when the editor opens and whenever it changes.
  useEffect(() => {
    if (DEMO || !token) { setLogin(''); return }
    let live = true
    github.whoAmI(token).then((who) => {
      if (!live) return
      if (who === null) expire(token)
      else setLogin(who)
    }, () => { /* offline or GitHub unavailable: keep the sign-in and try again on the next save */ })
    return () => { live = false }
  }, [token])
  const [notice, setNoticeState] = useState<Notice>(start.restored ? { text: 'Your changes from last time are back, exactly as you left them. To go back to the published page instead, choose More, then Discard changes (Undo brings them back again).' } : { text: '' })
  const setNotice = (text: string, undo = false) => setNoticeState({ text, undo })
  const saveTimer = useRef<number>(undefined)
  // The page as published, in the form the editor holds it; matching it means nothing is unsaved.
  // '' means "take the next state the editor shows as the published one".
  const clean = useRef<string | null>(start.restored ? null : '')

  // Keep unsaved work in this browser, a moment after each change, and at once if the tab is being
  // closed, reloaded or hidden, so the last change is never lost. If the browser will not keep it,
  // the status says so and closing the tab asks first.
  const latestData = useRef<Data | null>(null)
  const [keptHere, setKeptHere] = useState(true)
  const keep = () => {
    window.clearTimeout(saveTimer.current)
    const data = latestData.current
    if (!data) return
    const json = JSON.stringify(data)
    if (json === clean.current) { removeLocal(localKey(p.slug, 'unsaved')); setKeptHere(true) }
    else setKeptHere(writeLocal(localKey(p.slug, 'unsaved'), data))
  }
  const onChange = (data: Data) => {
    latestData.current = data
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(keep, 400)
  }
  useEffect(() => {
    const now = () => keep()
    const hidden = () => { if (document.visibilityState === 'hidden') keep() }
    window.addEventListener('pagehide', now)
    document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('pagehide', now); document.removeEventListener('visibilitychange', hidden) }
  })
  // The same page open in another tab of this browser: both keep their unsaved work in one place,
  // so say so rather than let one tab quietly replace the other's.
  const [elsewhere, setElsewhere] = useState(false)
  useEffect(() => {
    const other = (e: StorageEvent) => { if (e.key === localKey(p.slug, 'unsaved') && e.newValue) setElsewhere(true) }
    window.addEventListener('storage', other)
    return () => window.removeEventListener('storage', other)
  }, [p.slug])
  useEffect(() => { if (elsewhere) setNotice('This page was also changed in another tab of this browser. Keep working in one tab: the last tab to change it is the one kept if you reload.') }, [elsewhere])

  useEffect(labelPuckControls, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // GitHub refused this sign-in. Your own is forgotten; the shared one is left for Sveltia to renew.
  function expire(t: string) {
    refused.current = t
    forgetOwn()
    const shared = sharedToken() === t
    setAccount(currentAccount(t))
    setLogin('')
    return shared
  }
  const signOut = () => {
    signOutHere()
    refused.current = null
    setAccount(null)
    setLogin('')
    setNotice('Signed out of both editors in this browser. If the website editor (/admin) is open in another tab, close or reload it too. To cancel the sign-in at GitHub as well, open GitHub, Settings, Applications, and revoke "Zafran website editor (Sveltia CMS)".')
  }
  const actions = useMemo(() => ({ p, token, setToken, setNotice, notice, markClean: () => { clean.current = '' }, clean, login, shared: !!account?.shared, expire, signOut, keptHere }), [p, token, notice, login, account, keptHere])
  return (
    <SessionContext.Provider value={actions}>
      <SelectionProvider>
      <Puck
        config={config}
        data={start.data}
        // The page as opened is the first step of Undo, also when it was restored from last time.
        initialHistory={{ histories: [{ state: { data: start.data } }], index: 0, appendData: false }}
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
type Session = { p: Project; token: string | null; setToken: (t: string | null) => void; setNotice: (n: string, undo?: boolean) => void; notice: Notice; markClean: () => void; clean: { current: string | null }; login: string; shared: boolean; expire: (t: string) => boolean; signOut: () => void; keptHere: boolean }

// The left-hand tools, named for what they do.
// Puck's own Blocks and Outline panels are replaced by one Sections panel, which takes the
// "blocks" slot; the "outline" slot is filled with nothing and its rail button is hidden (editor.css).
const PLUGINS = [{ name: 'blocks', label: 'Sections', icon: <LayersIcon />, render: SectionsPanel }, { name: 'outline', label: 'Outline', render: () => <></> }, { ...fieldsPlugin(), label: 'Settings', icon: <SlidersIcon /> }]

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
        <button type="button" onClick={() => { dispatch({ type: 'setUi', ui: { leftSideBarVisible: true, plugin: { current: 'blocks' } } }); openSections('add') }}>Add a section</button>
        <button type="button" onClick={() => { dispatch({ type: 'setUi', ui: { leftSideBarVisible: true, plugin: { current: 'blocks' } } }); openSections('page') }}>Find or reorder sections</button>
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

const SCREEN_NAME = { desktop: 'Desktop', tablet: 'Tablet', phone: 'Phone' } as const
const SCREENS_BAR: [string, number][] = [['Desktop', 1440], ['Tablet', 1024], ['Phone', 390]]
const DESKTOP_WIDTHS = [1280, 1440, 1920]
// "23 Nov, 14:40": the day is included because the status is remembered across reloads.
const time = () => new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

// The top bar: the project, the screen size being edited, undo and redo, where the work stands,
// and the three steps that matter: preview, save a draft, publish.
function Actions() {
  const { p, token, setToken, setNotice, notice, markClean, clean, login, shared, expire, signOut, keptHere } = useContext(SessionContext)!
  const data = usePuck((s) => s.appState.data)
  const history = usePuck((s) => s.history)
  // What one step back or forward changes, in words (shown on the buttons and after undoing).
  const pageAt = (i: number) => (history.histories[i]?.state as { data?: never } | undefined)?.data
  const undoWhat = describeStep(pageAt(history.index - 1), pageAt(history.index))
  const redoWhat = describeStep(pageAt(history.index), pageAt(history.index + 1))
  const [undone, setUndone] = useState('')
  // Undo and Redo from the buttons or the keyboard: one step back (or forward, with nothing new added).
  const step = useRef({ index: history.index, length: history.histories.length })
  useEffect(() => {
    const was = step.current
    step.current = { index: history.index, length: history.histories.length }
    if (history.histories.length !== was.length) return
    if (history.index === was.index - 1) setUndone(`Undone: ${describeStep(pageAt(history.index), pageAt(history.index + 1))}. Redo puts it back.`)
    else if (history.index === was.index + 1) setUndone(`Redone: ${describeStep(pageAt(history.index - 1), pageAt(history.index))}.`)
  }, [history.index, history.histories.length])
  useEffect(() => { if (!undone) return; const t = setTimeout(() => setUndone(''), 4000); return () => clearTimeout(t) }, [undone])
  // The last confirmed save, remembered across reloads so a saved draft is not shown as unsaved.
  const [saved, setSavedState] = useState<{ json: string; text: string } | null>(() => readLocal(localKey(p.slug, 'saved'), null))
  const setSaved = (v: { json: string; text: string }) => { setSavedState(v); writeLocal(localKey(p.slug, 'saved'), v) }
  const [failed, setFailed] = useState('') // the page as it was when a save or publish failed
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const [preview, setPreview] = useState(false)
  const { select, selected } = useContext(Selection)
  const selectedItem = usePuck((s) => s.selectedItem)
  // Which sizes the selected part has its own settings on (shown as a dot on that size's button).
  const ownAt = (() => {
    const els = (selectedItem?.props as { elements?: Record<string, Record<string, object>> } | undefined)?.elements
    const style = selected && selectedItem && selected.blockId === selectedItem.props.id ? els?.[selected.key] : undefined
    return new Set(Object.entries(style ?? {}).filter(([, v]) => v && Object.keys(v).length).map(([k]) => k))
  })()
  useEffect(() => { if (clean.current === '') clean.current = JSON.stringify(data) }, [data, clean])
  const dispatch = usePuck((s) => s.dispatch)
  const [busy, setBusy] = useState('')
  const [panel, setPanel] = useState<'' | 'publish' | 'history' | 'reset'>('')
  const ui = usePuck((s) => s.appState.ui)
  // Puck draws the rail buttons (Sections, Settings) as plain boxes; make them real buttons for the
  // keyboard and screen readers, saying which panel is open.
  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[class*='_NavItem-link_']").forEach((b) => {
      if (b.dataset.kb) { b.setAttribute('aria-pressed', String(!!b.closest("[class*='_NavItem--active']"))); return }
      b.dataset.kb = '1'
      b.setAttribute('role', 'button')
      b.tabIndex = 0
      b.setAttribute('aria-pressed', String(!!b.closest("[class*='_NavItem--active']")))
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click() } })
    })
  })
  // Undo and Redo bring back the page, not the editor's own layout: Puck stores both in each step,
  // so after a step back or forward the open panels and the screen size being edited are put back
  // as they were. Without this, Undo could close the Sections panel or switch from Phone to Desktop.
  const layout = (u: typeof ui) => ({ leftSideBarVisible: u.leftSideBarVisible, rightSideBarVisible: u.rightSideBarVisible, plugin: u.plugin, viewports: u.viewports })
  const kept = useRef(layout(ui))
  const seenStep = useRef(history.index)
  useEffect(() => {
    if (history.index !== seenStep.current) {
      seenStep.current = history.index
      if (JSON.stringify(layout(ui)) !== JSON.stringify(kept.current)) dispatch({ type: 'setUi', ui: kept.current })
      return
    }
    kept.current = layout(ui)
  }, [ui, history.index])
  const [findings, setFindings] = useState<Finding[] | null>(null)

  // Check the page at the given screen sizes, then put the preview back where it was. Used before
  // publishing (all three sizes) and by "Check Tablet and Phone" in the layout notes.
  const checkSizes = async (sizes: [string, number][]) => {
    const found: Finding[] = []
    for (const [screen, width] of sizes) {
      dispatch({ type: 'setUi', ui: { viewports: { ...ui.viewports, current: { width, height: 'auto' } } } })
      await new Promise((r) => setTimeout(r, 700))
      const doc = (document.getElementById('preview-frame') as HTMLIFrameElement | null)?.contentDocument
      if (doc) { await settled(doc); found.push(...checkPage(doc, screen, nameOf, checkOptions(p))) }
    }
    dispatch({ type: 'setUi', ui: { viewports: ui.viewports } })
    // Notes marked "This is intended" stay quiet here too.
    const intended = new Set((((data.root.props ?? {}) as { intended?: Intended[] }).intended ?? []).map((i) => i.id))
    return found.filter((f) => !intended.has(noteId(f)))
  }
  const openPublish = async () => {
    setPanel('publish')
    setFindings(null)
    setFindings(await checkSizes([['Desktop', 1440], ['Tablet', 1024], ['Phone', 390]]))
  }
  const [versions, setVersions] = useState<Version[]>([])
  const [more, setMore] = useState(false)
  const choose = (action: () => void) => () => { setMore(false); action() }
  const moreRef = useRef<HTMLDivElement>(null)
  // The More menu closes like other menus: Escape (focus goes back to More) or a click elsewhere.
  useEffect(() => {
    if (!more) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMore(false); moreRef.current?.querySelector('button')?.focus() } }
    const away = (e: PointerEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMore(false) }
    const blur = () => setMore(false) // a click inside the page preview (its own frame) blurs this window
    document.addEventListener('keydown', key)
    document.addEventListener('pointerdown', away)
    window.addEventListener('blur', blur)
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', away); window.removeEventListener('blur', blur) }
  }, [more])
  const warnings = layoutWarnings(data.content as never)
  // Image sections with no photo: publishing waits until each has one (a draft can still be saved).
  const empties = emptyImages(data.content as never)
  const renames = categoryEdits(((data.root.props as { edits?: Edits } | undefined)?.edits) ?? {}).map(([field, to]) => [field.match(CATEGORY_FIELD)![1], to] as const)
  const json = JSON.stringify(data)
  // Different from the published page (a saved draft still counts), and not yet saved anywhere.
  const unpublished = clean.current !== '' && json !== clean.current
  const unsaved = unpublished && json !== saved?.json
  // One clear save state: failed, saving, saved (draft or published), not saved yet, or up to date.
  const state: 'failed' | 'busy' | 'saved' | 'unsaved' | 'clean' | 'unkept' =
    busy ? 'busy' : failed && failed === json ? 'failed' : saved && json === saved.json ? 'saved' : unsaved ? (keptHere ? 'unsaved' : 'unkept') : 'clean'
  const status = {
    failed: 'Not saved: see the message',
    busy: `${busy}…`,
    saved: saved?.text ?? '',
    unsaved: online ? 'Not saved yet' : 'Offline: kept in this browser',
    unkept: 'Not saved, and not kept here',
    clean: unpublished ? 'Draft saved, not published' : 'Same as the website',
  }[state]
  const statusHint = {
    failed: 'The last save did not work. Nothing was changed on the website. Try again, or read the message for why.',
    busy: undefined,
    saved: undefined,
    unsaved: online ? 'Your changes are kept safely in this browser. Save a draft or publish when ready.' : 'You are offline. Your changes are kept in this browser; save a draft when you are back online.',
    unkept: 'This browser would not keep a copy (its storage is full or blocked). Save a draft now; closing the tab would lose these changes.',
    clean: undefined,
  }[state]
  // Closing the tab asks first only when work could be lost: nothing kept in this browser, or a
  // save still on its way.
  useEffect(() => {
    if (state !== 'unkept' && state !== 'busy') return
    const ask = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', ask)
    return () => window.removeEventListener('beforeunload', ask)
  }, [state])
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
    const saving = label === 'Saving the draft' || label === 'Publishing'
    if (saving) setFailed('')
    try { setNotice(await task()) } catch (e) {
      if (saving) setFailed(JSON.stringify(data))
      const message = (e as Error).message
      // An expired or withdrawn sign-in: forget it, so "Sign in with GitHub" shows again.
      if (/\b401\b|Bad credentials/i.test(message) && token) {
        const wasShared = expire(token)
        setNotice(`${label} did not work because your sign-in has expired. Nothing was changed. ${wasShared ? 'Open the website editor (/admin) in another tab to renew it, or choose Sign in, then try again.' : 'Choose Sign in, then try again.'}`)
      } else if (e instanceof TypeError || !navigator.onLine) {
        setNotice(`${label} did not work: the connection to GitHub was lost. Nothing was changed on the website, and your changes are still kept in this browser. Try again when you are back online.`)
      } else setNotice(`${label} did not work: ${message} Nothing was changed on the website, and your changes are still kept in this browser.`)
    } finally { setBusy('') }
  }
  const needToken = () => { if (!token) throw new Error('Sign in first.'); return token }
  const stamp = () => new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

  const signIn = () => run('Sign-in', async () => {
    const t = await github.signIn()
    keepOwn(t)
    setToken(t)
    return 'Signed in. Drafts and publishing now save to the website.'
  })

  const saveDraft = () => run('Saving the draft', async () => {
    if (saved && JSON.stringify(data) === saved.json) return `Already saved: nothing has changed since the ${saved.text.toLowerCase()}.`
    if (DEMO) { try { localStorage.setItem(localKey(p.slug, 'draft'), JSON.stringify(data)) } catch { throw new Error('This browser would not keep the draft (its storage is full or blocked).') } setSaved({ json: JSON.stringify(data), text: `Draft saved ${time()}` }); return `Draft saved in this browser (${stamp()}). In the real editor it is saved to the drafts branch; nothing is published.` }
    await github.writeLayout(needToken(), p.slug, data, github.DRAFTS, `Design editor: draft for ${p.slug}`)
    setSaved({ json: JSON.stringify(data), text: `Draft saved ${time()}` })
    return `Draft saved (${stamp()}). Nothing is published until you choose Publish.`
  })

  const publish = () => run('Publishing', async () => {
    // Never publish an empty Image section, whichever way Publish was reached.
    if (emptyImages(data.content as never).length) throw new Error('An Image section has no photo yet. Choose a photo or remove the section, then publish.')
    setPanel('')
    if (DEMO) {
      const list = readLocal<Version[]>(localKey(p.slug, 'versions'), [])
      writeLocal(localKey(p.slug, 'versions'), [{ id: String(Date.now()), date: new Date().toISOString(), message: 'Published (demo)', layout: data }, ...list].slice(0, 30))
      removeLocal(localKey(p.slug, 'unsaved'))
      clean.current = JSON.stringify(data)
      setSaved({ json: clean.current, text: `Published ${time()}` })
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
    setSaved({ json: clean.current, text: `Published ${time()}` })
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
    dispatch({ type: 'setData', recordHistory: true, data: layout as Data })
    setPanel('')
    return `Loaded the version from ${new Date(v.date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. Nothing is published until you choose Publish; Undo takes you back.`
  })

  const loadStandard = () => {
    dispatch({ type: 'setData', recordHistory: true, data: standardCaseLayout() as Data })
    setPanel('')
    setNotice('The standard layout is loaded. Publish to use it on the website; Undo takes you back.')
  }

  // Discarding keeps a copy of what was discarded, and the message's Undo puts exactly that back,
  // so nothing is ever thrown away by one click.
  const discarded = useRef<Data | null>(null)
  const discardUnsaved = () => {
    discarded.current = JSON.parse(JSON.stringify(data)) as Data
    removeLocal(localKey(p.slug, 'unsaved'))
    markClean()
    dispatch({ type: 'setData', recordHistory: true, data: (savedLayoutFor(p) ?? standardCaseLayout()) as Data })
    setNotice('Changes discarded. The page is as last published. Undo brings them back.', true)
  }
  const undoNotice = () => {
    if (discarded.current && notice.text.startsWith('Changes discarded')) dispatch({ type: 'setData', recordHistory: true, data: discarded.current })
    else history.back()
    discarded.current = null
    setNotice('')
  }

  return (
    <header className="editor-bar">
      <PhotoPicker />
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
            const own = ownAt.has(name.toLowerCase())
            return <button key={name} type="button" aria-pressed={on} title={own ? `The selected part has its own settings on ${name}` : undefined} onClick={() => showWidth(width)}>{name}{own && <span className="editor-own-dot"><span className="sr-only"> (selected part set here)</span></span>}</button>
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
          <button type="button" onClick={history.back} disabled={!history.hasPast} title={history.hasPast ? `Undo: ${undoWhat} (Cmd+Z)` : 'Nothing to undo'} aria-label={history.hasPast ? `Undo: ${undoWhat}` : 'Undo'}><UndoIcon /><span className="editor-word">Undo</span></button>
          <button type="button" onClick={history.forward} disabled={!history.hasFuture} title={history.hasFuture ? `Redo: ${redoWhat} (Cmd+Shift+Z)` : 'Nothing to redo'} aria-label={history.hasFuture ? `Redo: ${redoWhat}` : 'Redo'}><RedoIcon /><span className="editor-word">Redo</span></button>
        </div>
        <span className={`editor-status is-${state}`} role="status" title={statusHint}><span className="editor-status-mark" aria-hidden="true" />{status}</span>
        <LayoutNotes p={p} screen={SCREEN_NAME[screenFor(Number(ui.viewports.current.width) || 1440)]} preview={preview} checkSizes={checkSizes} />
        <button type="button" className="editor-quiet editor-preview" aria-pressed={preview} onClick={togglePreview}><EyeIcon /><span>{preview ? 'Back to editing' : 'Preview'}</span></button>
        <div className="editor-more-wrap" ref={moreRef}>
          <button type="button" className="editor-quiet" aria-expanded={more} aria-haspopup="true" onClick={() => setMore(!more)}>More <span aria-hidden="true">▾</span></button>
          <div className={more ? 'editor-more open' : 'editor-more'}>
            <button type="button" onClick={choose(openHistory)} disabled={!!busy}>Versions <small>bring back an earlier version</small></button>
            <button type="button" onClick={choose(discardUnsaved)} disabled={!!busy || !unpublished}>Discard changes <small>go back to the published page</small></button>
            <button type="button" onClick={choose(() => setPanel('reset'))} disabled={!!busy}>Standard layout <small>start again from the template</small></button>
            {!DEMO && token && <button type="button" onClick={choose(signOut)} disabled={!!busy}>Sign out <small>{login ? `signed in as ${login}` : 'signed in'}{shared ? ', shared with the website editor' : ''}; signs out of both here</small></button>}
          </div>
        </div>
        {!DEMO && !token && <button type="button" className="editor-signin" onClick={signIn} disabled={!!busy}>Sign in</button>}
        <button type="button" className="editor-save" onClick={saveDraft} disabled={!!busy} title="Saves without changing the website">Save<span className="editor-long"> draft</span></button>
        <button type="button" className="editor-primary" onClick={openPublish} disabled={!!busy} title="Checks the page, then updates the website">Publish</button>
      </div>
      <div className="editor-bar-ctx" onKeyDown={(e) => { if (e.key === 'Escape' && !e.defaultPrevented && !(e.target as HTMLElement).closest('input, textarea, select, .ctx-menu')) select(null) }}>{!preview && <MoreTools />}{preview ? <p className="ctx ctx-hint">Previewing the page exactly as visitors see it. Nothing here can be changed until you go back to editing.</p> : <ContextBar />}</div>
      {warnings.length > 0 && <p className="editor-demo editor-checks">{warnings.join(' ')}</p>}
      {undone && <p className="editor-undone" role="status">{undone}</p>}
      {notice.text && (
        <div className="editor-notice" role="status">
          <p>{notice.text}</p>
          {notice.undo && <button type="button" onClick={undoNotice}>Undo</button>}
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
          {empties.length > 0 && (
            <div className="editor-blocked" role="alert">
              <p><b>{empties.length === 1 ? 'An Image section has no photo yet.' : `${empties.length} Image sections have no photo yet.`}</b> Choose a photo, or remove the section, before publishing. Saving a draft still works.</p>
              <ul>{empties.map((id, k) => <li key={id}><button type="button" onClick={() => { setPanel(''); openPhotoPicker(id) }}>Choose a photo{empties.length > 1 ? ` (${k + 1})` : ''}</button></li>)}</ul>
            </div>
          )}
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
          <button type="button" className="editor-primary" onClick={publish} disabled={findings === null || empties.length > 0}>{findings?.length ? 'Publish anyway' : 'Publish'}</button>
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

// On narrow screens the editing tools scroll sideways. These arrows show that more tools are
// there and scroll to them; keyboard users reach the same tools with Tab.
function MoreTools() {
  const [edge, setEdge] = useState({ left: false, right: false })
  useEffect(() => {
    let bar: HTMLElement | null = null
    const measure = () => {
      const next = document.querySelector<HTMLElement>('.editor-bar-ctx .ctx')
      if (next !== bar) { bar?.removeEventListener('scroll', measure); bar = next; bar?.addEventListener('scroll', measure, { passive: true }) }
      const left = !!bar && bar.scrollLeft > 4
      const right = !!bar && bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 4
      setEdge((e) => (e.left === left && e.right === right ? e : { left, right }))
    }
    measure()
    const watch = new MutationObserver(measure)
    watch.observe(document.querySelector('.editor-bar-ctx')!, { childList: true, subtree: true })
    window.addEventListener('resize', measure)
    return () => { watch.disconnect(); window.removeEventListener('resize', measure); bar?.removeEventListener('scroll', measure) }
  }, [])
  const go = (dir: number) => {
    const bar = document.querySelector<HTMLElement>('.editor-bar-ctx .ctx')
    bar?.scrollBy({ left: dir * bar.clientWidth * 0.6, behavior: 'smooth' })
  }
  return (
    <>
      {edge.left && <button type="button" className="ctx-scroll ctx-scroll-left" tabIndex={-1} aria-hidden="true" title="Earlier tools" onClick={() => go(-1)}>‹</button>}
      {edge.right && <button type="button" className="ctx-scroll ctx-scroll-right" tabIndex={-1} aria-hidden="true" title="More tools" onClick={() => go(1)}>›</button>}
    </>
  )
}
