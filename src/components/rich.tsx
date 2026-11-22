import { Fragment } from 'react'

// Simple formatting in text from the website editor. Everything else stays plain text.
//   *bold*        → bold, in the same typeface and colour (only the weight changes)
//   **highlight** → the approved light-sage highlight, in fields that offer it (highlight={true});
//                   in other fields it is shown as bold rather than as stray asterisks
// A single asterisk on its own (for example "5*" or "* note") is left as it is.
// Highlighted phrases up to this length fit on one line even on a 360px phone, so they are never split.
const MAX_UNBROKEN = 28
const PATTERN = /(\*\*[^*]+\*\*|\*[^*\s](?:[^*]*[^*\s])?\*)/g

export function Rich({ text, highlight = false }: { text?: string; highlight?: boolean }) {
  if (!text) return null
  return (
    <>
      {text.split(PATTERN).map((part, i) => {
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
          const words = part.slice(2, -2)
          return highlight ? (
            <mark key={i} className={words.length <= MAX_UNBROKEN ? 'hl hl-keep' : 'hl'}>
              {words}
            </mark>
          ) : (
            <strong key={i} className="b">{words}</strong>
          )
        }
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
          return <strong key={i} className="b">{part.slice(1, -1)}</strong>
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}
