import { croppedSizes, imageProps, photoSize, type Img } from '#/lib/site'

// sizes: how wide the image is shown, so the browser can choose the right-sized copy.
// focus: which part of a cropped photo stays in view, as a CSS object-position (for example '50% 20%').
type Props = { img?: Img; ratio?: string; label?: string; sizes?: string; focus?: string }

// Until an image is uploaded, a hairline frame holds its place so layouts can be judged without it.
export function Media({ img, ratio = '4/3', label, sizes = '(max-width: 899px) 100vw, 75vw', focus }: Props) {
  // 'auto' shows the photo at its own proportions: use the original's, so a smaller copy's
  // rounding never changes the height by a fraction of a pixel.
  const size = ratio === 'auto' ? photoSize(img?.image) : undefined
  const style = { aspectRatio: size ? `${size.width} / ${size.height}` : ratio, ...(focus && { objectPosition: focus }) }
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
