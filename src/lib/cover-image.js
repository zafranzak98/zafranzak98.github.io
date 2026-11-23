// How a project's cover is shown: the shape of its frame and how wide it appears on screen.
//
// The page (src/components/opening-visual.tsx) draws the cover with these values, and the build
// (scripts/postbuild.mjs) uses the same ones to name each page's cover in the page's head, so the
// browser starts downloading it straight away instead of after the page's script has run. Keeping
// them here means the two always ask for the same file. Plain JavaScript so the build can use it.

// The frame: width / height as 'w/h', or 'auto' to show the artwork at its own proportions.
export const coverFrame = (design) =>
  design === 'about-face' || design === 'fc-yeah' ? 'auto' : design === 'bersih' ? '4/5' : '3/4'

// How wide the cover is shown: in a band on a Projects page (15vw, Evoke 24.5vw; most of the
// width on a phone) or in a case study opening (up to 26vw; 250px on a phone). Evoke shows its
// before and after covers side by side, so each is half as wide.
export const coverSizes = (design, inBand) => {
  if (design === 'evoke') return inBand ? '(max-width: 899px) 40vw, 12.5vw' : '(max-width: 899px) 125px, 13vw'
  return inBand ? '(max-width: 899px) 62vw, 15vw' : '(max-width: 899px) 250px, 26vw'
}

// A photo cropped to fill a frame of another shape (object-fit: cover) needs more pixels than the
// frame's width: a wide photo in a tall frame is shown at the frame's height. frameRatio is the
// frame's width / height; the sizes values grow by how much wider the photo is than the frame.
export const croppedSizesFor = (sizes, size, frameRatio) => {
  if (!size || !frameRatio) return sizes
  const factor = size.width / size.height / frameRatio
  if (factor <= 1.01) return sizes
  return sizes
    .split(',')
    .map((entry) => entry.trim().replace(/(\S+)$/, (value) => `calc(${value} * ${factor.toFixed(3)})`))
    .join(', ')
}
