import { useState } from 'react'
import { imageProps, photoSize, type Img } from '#/lib/site'
import { Media } from '#/components/media'

function Chevron({ dir, enabled, onClick }: { dir: 'l' | 'r'; enabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="chev" aria-label={dir === 'l' ? 'Previous image' : 'Next image'} disabled={!enabled} onClick={onClick}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d={dir === 'l' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  )
}

// The full gallery, based on Liana's original image carousel: arrows, one image at a time, dots.
export default function Gallery({ images = [], note }: { images?: Img[]; note?: string }) {
  const [i, setI] = useState(0)
  const shown = images.filter((g) => g.image)
  if (!shown.length && !note) return null
  const n = shown.length
  const cur = shown[Math.min(i, Math.max(n - 1, 0))]
  return (
    <div className="gallery">
      <div className="gallery-head">
        <span className="lab">Full gallery{n ? ` · ${n} images` : note ? ` · ${note}` : ''}</span>
        {n > 1 && (
          <div className="gallery-arrows">
            <Chevron dir="l" enabled={i > 0} onClick={() => setI(i - 1)} />
            <Chevron dir="r" enabled={i < n - 1} onClick={() => setI(i + 1)} />
          </div>
        )}
      </div>
      {n > 0 && note && <p className="gallery-note">{note}</p>}
      {n ? (
        <>
          <div className="gallery-frame">
            {/* Never wider than the photo itself, as before responsive images: a small photo is not enlarged. */}
            <img {...imageProps(cur.image, '(max-width: 899px) 100vw, 90vw')} alt={cur.alt ?? ''} style={photoSize(cur.image) && { maxWidth: `min(100%, ${photoSize(cur.image)!.width}px)` }} />
          </div>
          {n > 1 && (
            <div className="dots" role="group" aria-label="Choose an image">
              {shown.map((_, k) => (
                <button key={k} type="button" aria-label={`Show image ${k + 1}`} aria-current={k === i} className={k === i ? 'dot dot-on' : 'dot'} onClick={() => setI(k)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <Media ratio="21/9" label="gallery images" />
      )}
    </div>
  )
}
