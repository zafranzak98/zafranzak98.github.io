import { Fragment } from 'react'

// Turns **bold** in CMS text into the approved light-sage highlight. Everything else stays plain text.
export function Rich({ text }: { text?: string }) {
  if (!text) return null
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <mark key={i} className="hl">
            {part.slice(2, -2)}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
