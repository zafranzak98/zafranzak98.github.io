// The editor's floating messages (the Layout notes button, its "Desktop changes also apply..." hint
// and the Undo message) sit over the foot of the canvas. While one shows, the canvas keeps the same
// amount of room at its foot: anything scrolled into view (a selection, a part found from Layout
// notes, the keyboard) stops above the messages, and the end of the page can always be scrolled
// clear of them. Without this, words near the bottom of the canvas could sit under the hint and
// could not be clicked (seen at a 900 px window height, where the shared header pushes the page
// down). On the website nothing changes: this only touches the editor's own canvas.

const FLOATS = '.editor-notes-btn, .editor-notes-hint, .editor-undone'
const GAP = 12 // px of clear space above the messages

export function keepCanvasClear() {
  let applied = ''
  const measure = () => {
    const frame = document.getElementById('preview-frame') as HTMLIFrameElement | null
    const doc = frame?.contentDocument
    const win = frame?.contentWindow
    if (!frame || !doc?.documentElement || !win) return
    const box = frame.getBoundingClientRect()
    if (!box.height) return
    // The canvas is drawn scaled down; work in the page's own pixels.
    const scale = box.height / (win.innerHeight || box.height) || 1
    let top = box.bottom
    document.querySelectorAll<HTMLElement>(FLOATS).forEach((f) => {
      const r = f.getBoundingClientRect()
      if (!r.height || r.right <= box.left || r.left >= box.right || r.top >= box.bottom || r.bottom <= box.top) return
      top = Math.min(top, r.top)
    })
    const room = top < box.bottom ? `${Math.ceil((box.bottom - top + GAP) / scale)}px` : ''
    const html = doc.documentElement
    if (room === applied && html.style.scrollPaddingBottom === room) return
    applied = room
    html.style.scrollPaddingBottom = room
    html.style.paddingBottom = room
  }
  measure()
  const watch = new MutationObserver(measure)
  watch.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', measure)
  const timer = window.setInterval(measure, 1000) // a new canvas (another screen size) is measured too
  return () => { watch.disconnect(); window.removeEventListener('resize', measure); window.clearInterval(timer) }
}
