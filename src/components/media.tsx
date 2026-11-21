import type { CSSProperties } from 'react'
import { asset, type Img } from '#/lib/site'

type Props = { img?: Img; ratio?: string; label?: string; className?: string; tone?: 'lsage' | 'off' | 'sage'; outline?: boolean }

// An image from the CMS, or a clearly marked placeholder when no image has been uploaded yet.
export function Media({ img, ratio = '4/3', label, className = '', tone = 'lsage', outline }: Props) {
  const style = { aspectRatio: ratio } as CSSProperties
  if (img?.image) {
    return <img className={`media ${className}`} src={asset(img.image)} alt={img.alt ?? ''} style={style} loading="lazy" />
  }
  return (
    <div className={`ph ph-${tone} ${outline ? 'ph-outline' : ''} ${className}`} style={style}>
      <span>
        <b>Placeholder</b> · {label ?? img?.alt ?? 'image'}
      </span>
    </div>
  )
}

// Phone frame used by the About-Face Beauty case study.
export function Phone({ img, width, caption }: { img?: Img; width: number; caption?: string }) {
  return (
    <figure className="phone" style={{ '--w': `${width}px` } as CSSProperties}>
      <div className="phone-body">
        <div className="phone-screen">
          {img?.image ? (
            <img src={asset(img.image)} alt={img.alt ?? ''} loading="lazy" />
          ) : (
            <span>
              <b>Placeholder</b>
              <br />
              {img?.alt ?? 'AR filter on a face'}
            </span>
          )}
        </div>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
