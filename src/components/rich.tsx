import { Fragment } from 'react'

// Turns **bold** in CMS text into the approved light-sage highlight. Everything else stays plain text.
// Phrases up to this length fit on one line even on a 360px phone, so they are never split.
const MAX_UNBROKEN = 28

export function Rich({ text }: { text?: string }) {
  if (!text) return null
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <mark key={i} className={part.length - 4 <= MAX_UNBROKEN ? 'hl hl-keep' : 'hl'}>
            {part.slice(2, -2)}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
