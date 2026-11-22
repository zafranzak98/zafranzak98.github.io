// WebP for browsers that cannot make it themselves (Safari on Mac, and every browser on iPhone
// and iPad, which all use Safari's engine).
//
// The website editor converts uploaded photos to WebP in the browser. Chrome, Edge and Firefox
// do this natively. Safari cannot: asked for WebP it quietly returns PNG. The editor then tries to
// download a converter from unpkg.com, which this page's security policy refuses, so on Safari
// uploads were saved as large PNG files.
//
// This script gives the editor the same converter (@jsquash/webp, the one it would have fetched),
// served from this website at a version pinned in package.json. It only steps in when the browser
// cannot make WebP; everywhere else the browser's own conversion runs exactly as before. If the
// converter ever fails to load, the browser's normal result is used, which is how the editor
// behaved before this script existed.
//
// Loaded before the editor, from /admin/index.html (see scripts/postbuild.mjs).
;(() => {
  if (typeof OffscreenCanvas === 'undefined') return
  const native = OffscreenCanvas.prototype.convertToBlob
  let browserMakesWebp
  const canMakeWebp = async () => {
    if (browserMakesWebp === undefined) {
      const test = new OffscreenCanvas(1, 1)
      test.getContext('2d')
      browserMakesWebp = (await native.call(test, { type: 'image/webp' })).type === 'image/webp'
    }
    return browserMakesWebp
  }
  let encoder
  OffscreenCanvas.prototype.convertToBlob = async function (options) {
    if (options?.type !== 'image/webp' || (await canMakeWebp())) return native.call(this, options)
    const context = this.getContext('2d')
    if (!context) return native.call(this, options)
    try {
      encoder ??= import('/admin/vendor/jsquash-webp/encode.js').then((m) => m.default)
      const encode = await encoder
      const quality = typeof options.quality === 'number' ? Math.round(options.quality * 100) : 75
      const data = await encode(context.getImageData(0, 0, this.width, this.height), { quality })
      return new Blob([data], { type: 'image/webp' })
    } catch (error) {
      encoder = undefined
      console.warn('The WebP converter could not run; the image is saved in the browser’s own format.', error)
      return native.call(this, options)
    }
  }
})()
