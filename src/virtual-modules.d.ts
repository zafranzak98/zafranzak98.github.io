// Made by the image-widths plugin in vite.config.ts: [width, height] in pixels of each published photo.
declare module 'virtual:image-widths' {
  const widths: Record<string, [number, number]>
  export default widths
}
