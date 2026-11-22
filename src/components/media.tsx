import type { CSSProperties } from 'react'
import { croppedSizes, imageProps, photoSize, type Img } from '#/lib/site'
import { Rich } from '#/components/rich'

// sizes: how wide the image is shown, so the browser can choose the right-sized copy.
type Props = { img?: Img; ratio?: string; label?: string; sizes?: string }

// Until an image is uploaded, a hairline frame holds its place so layouts can be judged without it.
export function Media({ img, ratio = '4/3', label, sizes = '(max-width: 899px) 100vw, 75vw' }: Props) {
  // 'auto' shows the photo at its own proportions: use the original's, so a smaller copy's
  // rounding never changes the height by a fraction of a pixel.
  const size = ratio === 'auto' ? photoSize(img?.image) : undefined
  const style = { aspectRatio: size ? `${size.width} / ${size.height}` : ratio }
  if (img?.image) {
    // The frame's proportions (for example '4/5'), so a photo cropped to fill it is still sharp.
    const [fw, fh] = ratio.split('/').map(Number)
    const frame = fh ? fw / fh : undefined
    return <img className="media" {...imageProps(img.image, croppedSizes(sizes, img.image, frame))} alt={img.alt ?? ''} style={style} loading="lazy" decoding="async" />
  }
  return (
    <div className="ph" style={style}>
      <span>
        <b>Placeholder</b> · {label ?? img?.alt ?? 'image'}
      </span>
    </div>
  )
}

// Phone frame used by the About-Face Beauty case study. width is any CSS length.
export function Phone({ img, width, caption, sizes = '(max-width: 899px) 250px, 15vw' }: { img?: Img; width: string; caption?: string; sizes?: string }) {
  return (
    <figure className="phone" style={{ '--w': width } as CSSProperties}>
      <div className="phone-body">
        <div className="phone-screen">
          {/* The screen is about 0.46 times as wide as it is tall; photos are cropped to fill it. */}
          {img?.image ? (
            <img {...imageProps(img.image, croppedSizes(sizes, img.image, 0.46))} alt={img.alt ?? ''} loading="lazy" decoding="async" />
          ) : (
            <span>
              <b>Placeholder</b>
              <br />
              {img?.alt ?? 'AR filter on a face'}
            </span>
          )}
        </div>
      </div>
      {caption && <figcaption><Rich text={caption} /></figcaption>}
    </figure>
  )
}
