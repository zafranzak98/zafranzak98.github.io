// Responsive images, worked out once for the whole site.
//
// Every photo the website uses is also published in smaller WebP copies (480, 960 and 1600 pixels
// wide, never wider than the original). Each image on a page lists the copies and how wide it is
// shown, and the browser downloads the smallest one that stays sharp on that screen. The original
// upload is never changed: it stays in the repository and is still offered as the largest size.
//
// The website (src/lib/site.ts) and the build (scripts/postbuild.mjs, which makes the copies) both
// use this file, so the names they use always agree. Plain JavaScript so the build can run it.

export const STEPS = [480, 960, 1600]

// Photos only. SVG, GIF and PDF files are published as they are.
export const isPhoto = (path) => /\.(jpe?g|png|webp)$/i.test(path)

// The copy of /media/x/photo.jpg that is 960 pixels wide is /media/x/photo-w960.webp.
export const variantPath = (path, width) => path.replace(/\.[^./]+$/, `-w${width}.webp`)

// The copies made for a photo of the given width: only sizes smaller than the original.
export const widthsFor = (originalWidth) => STEPS.filter((w) => w < originalWidth)
