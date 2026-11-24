import { Fragment, type ReactNode } from 'react'

// Simple formatting in text from the website editor and the design editor. Everything else stays plain text.
//   *bold*        → bold, in the same typeface and colour (only the weight changes)
//   _italic_      → italic
//   ++underline++ → underlined
//   **highlight** → the approved light-sage highlight, in fields that offer it (highlight={true});
//                   in other fields it is shown as bold rather than as stray asterisks
// They can be combined, one inside another: *bold and _bold italic_*.
// A marker only counts when the words inside it do not start or end with a space, so a single
// asterisk on its own (for example "5*" or "* note") or "C++ and C" is left as it is.
// Highlighted phrases up to this length fit on one line even on a 360px phone, so they are never split.
const MAX_UNBROKEN = 28

export type RichNode = string | { kind: 'bold' | 'italic' | 'underline' | 'highlight'; children: RichNode[] }

const MARKS: [string, 'highlight' | 'bold' | 'italic' | 'underline'][] = [['**', 'highlight'], ['++', 'underline'], ['*', 'bold'], ['_', 'italic']]

// Where a marker that opens at `from` closes, or -1. The words inside may hold other markers, but not
// the same one, and must not start or end with a space.
function closing(text: string, mark: string, from: number) {
  const start = from + mark.length
  if (start >= text.length || /\s/.test(text[start])) return -1
  let end = text.indexOf(mark, start + 1)
  // A single asterisk never closes on the first half of a double one.
  while (mark === '*' && end !== -1 && text[end + 1] === '*') end = text.indexOf(mark, end + 2)
  if (end === -1 || /\s/.test(text[end - 1])) return -1
  const inner = text.slice(start, end)
  if (mark === '*' && inner.includes('*')) return -1
  return end
}

export function parseRich(text: string, inside: string[] = []): RichNode[] {
  const out: RichNode[] = []
  let plain = ''
  let i = 0
  while (i < text.length) {
    const found = MARKS.find(([mark, kind]) => text.startsWith(mark, i) && !inside.includes(kind) && (kind !== 'highlight' || !inside.length))
    const end = found ? closing(text, found[0], i) : -1
    if (found && end !== -1) {
      const [mark, kind] = found
      if (plain) { out.push(plain); plain = '' }
      const inner = text.slice(i + mark.length, end)
      // A highlight holds plain words only.
      out.push({ kind, children: kind === 'highlight' ? [inner] : parseRich(inner, [...inside, kind]) })
      i = end + mark.length
    } else {
      plain += text[i]
      i += 1
    }
  }
  if (plain) out.push(plain)
  return out
}

function render(nodes: RichNode[], highlight: boolean): ReactNode {
  return nodes.map((n, i) => {
    if (typeof n === 'string') return <Fragment key={i}>{n}</Fragment>
    const inner = render(n.children, highlight)
    if (n.kind === 'highlight') {
      const words = n.children.join('')
      return highlight ? <mark key={i} className={words.length <= MAX_UNBROKEN ? 'hl hl-keep' : 'hl'}>{words}</mark> : <strong key={i} className="b">{words}</strong>
    }
    if (n.kind === 'bold') return <strong key={i} className="b">{inner}</strong>
    if (n.kind === 'italic') return <em key={i}>{inner}</em>
    return <u key={i}>{inner}</u>
  })
}

// The same words without their formatting, for places that show them as plain text.
export function plainText(text: string): string {
  const flat = (nodes: RichNode[]): string => nodes.map((n) => (typeof n === 'string' ? n : flat(n.children))).join('')
  return flat(parseRich(text))
}

export function Rich({ text, highlight = false }: { text?: string; highlight?: boolean }) {
  if (!text) return null
  return <>{render(parseRich(text), highlight)}</>
}
