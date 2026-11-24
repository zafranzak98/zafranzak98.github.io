import { parseRich, type RichNode } from '#/components/rich'

// Bold, italic and underline for part of the words, while they are typed on the page. The words are
// stored with the same simple markers the website already reads (src/components/rich.tsx):
// *bold*, _italic_, ++underline++ and **highlight**. While typing, they are shown as real formatting
// in an editable copy over the element; when typing ends, that copy is written back as markers.
// The browser's own editing commands do the selecting and toggling, so a selection, a caret (format
// what is typed next) and Cmd/Ctrl+B, I and U behave as in any text editor.

export type Command = 'bold' | 'italic' | 'underline'
// How the shortcut keys are written on this computer: ⌘B on a Mac, Ctrl+B elsewhere.
export const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+'
export type Formats = Record<Command, boolean>
// Formatting at the caret while words are typed, or null when nothing is being typed.
export const formatListeners = new Set<(f: Formats | null) => void>()

let box: HTMLElement | null = null
let startAtEnd = false

export const typingBox = () => box
// Typing that starts from a format button puts the caret at the end instead of selecting the words.
export const takeStartAtEnd = () => { const at = startAtEnd; startAtEnd = false; return at }

export function report() {
  if (!box) { formatListeners.forEach((fn) => fn(null)); return }
  const doc = box.ownerDocument
  const state = (c: Command) => { try { return doc.queryCommandState(c) } catch { return false } }
  formatListeners.forEach((fn) => fn({ bold: state('bold'), italic: state('italic'), underline: state('underline') }))
}

export function setTypingBox(el: HTMLElement | null) {
  box = el
  report()
}

// Apply a format to the selected words, or to what is typed next when nothing is selected. When no
// words are being typed yet, `start` begins typing (caret at the end) first.
export function formatWords(command: Command, start?: () => void) {
  if (!box && start) { startAtEnd = true; start() }
  if (!box || !box.isContentEditable) return
  box.focus()
  box.ownerDocument.execCommand('styleWithCSS', false, 'false')
  box.ownerDocument.execCommand(command)
  report()
}

const TAGS: Record<Exclude<RichNode, string>['kind'], string> = { bold: 'b', italic: 'i', underline: 'u', highlight: 'mark' }

// The stored words as formatted nodes for the editable copy (built node by node: never as HTML text).
export function fillBox(target: HTMLElement, text: string) {
  const doc = target.ownerDocument
  const add = (parent: Node, nodes: RichNode[]) => {
    for (const n of nodes) {
      if (typeof n === 'string') { parent.appendChild(doc.createTextNode(n)); continue }
      const el = doc.createElement(TAGS[n.kind])
      add(el, n.children)
      parent.appendChild(el)
    }
  }
  target.replaceChildren()
  add(target, parseRich(text))
}

type Run = { text: string; bold: boolean; italic: boolean; underline: boolean; highlight: boolean }

// The editable copy back to stored words. Formatting is read from what the browser shows (weight and
// style) and from the tags around each piece of text, so it works whichever way the browser marked it.
export function readBox(target: HTMLElement): string {
  const view = target.ownerDocument.defaultView!
  const base = view.getComputedStyle(target)
  const baseWeight = Number(base.fontWeight) || 400
  const runs: Run[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement!
      const look = view.getComputedStyle(parent)
      const within = (test: (el: Element) => boolean) => { for (let el: Element | null = parent; el && el !== target; el = el.parentElement) if (test(el)) return true; return false }
      runs.push({
        text: (node.textContent ?? '').replace(/\s+/g, ' '),
        bold: (Number(look.fontWeight) || 400) > baseWeight,
        italic: look.fontStyle === 'italic' && base.fontStyle !== 'italic',
        underline: within((el) => el.tagName === 'U' || /underline/.test((el as HTMLElement).style?.textDecoration ?? '') || /underline/.test((el as HTMLElement).style?.textDecorationLine ?? '')),
        highlight: within((el) => el.tagName === 'MARK'),
      })
      return
    }
    if (node.nodeName === 'BR' || node.nodeName === 'DIV' || node.nodeName === 'P') runs.push({ text: ' ', bold: false, italic: false, underline: false, highlight: false })
    node.childNodes.forEach(walk)
  }
  target.childNodes.forEach(walk)
  return write(runs).replace(/\s+/g, ' ').trim()
}

// Runs of text with their formatting, as words with markers. Markers nest in one fixed order (bold
// outside, then italic, then underline), and spaces are kept outside markers, so the result always
// reads back the same way.
const ORDER: Command[] = ['bold', 'italic', 'underline']
const MARK: Record<Command, string> = { bold: '*', italic: '_', underline: '++' }
export function write(runs: Run[]): string {
  let out = ''
  let open: Command[] = []
  let inHighlight = false
  const closeAll = () => { const space = out.match(/\s*$/)![0]; out = out.slice(0, out.length - space.length); while (open.length) out += MARK[open.pop()!]; return space }
  for (const run of runs) {
    if (!run.text) continue
    // Spaces alone never change the formatting: they join whatever is around them.
    if (!run.text.trim()) { out += run.text; continue }
    if (run.highlight !== inHighlight) {
      let space = closeAll()
      if (inHighlight) { out += '**'; inHighlight = false }
      const lead = run.text.match(/^\s*/)![0]
      out += space + lead
      if (run.highlight) { out += '**'; inHighlight = true }
      out += run.highlight ? run.text.slice(lead.length) : ''
      if (run.highlight) continue
      space = ''
      run.text = run.text.slice(lead.length)
    }
    if (inHighlight) { out += run.text; continue }
    const want = ORDER.filter((c) => run[c])
    if (want.join() !== open.join()) {
      const space = out.match(/\s*$/)![0]
      out = out.slice(0, out.length - space.length)
      // Close back to the longest part of the open markers that is still wanted, then open the rest.
      let keep = 0
      while (keep < open.length && keep < want.length && open[keep] === want[keep]) keep += 1
      while (open.length > keep) out += MARK[open.pop()!]
      const lead = run.text.match(/^\s*/)![0]
      out += space + lead
      for (const c of want.slice(keep)) { out += MARK[c]; open.push(c) }
      out += run.text.slice(lead.length)
      continue
    }
    out += run.text
  }
  const space = closeAll()
  if (inHighlight) out += '**'
  return out + space
}
