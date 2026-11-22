// Made by the image-widths plugin in vite.config.ts: [width, height] in pixels of each published photo.
// Made by the layouts plugin in vite.config.ts: saved design-editor layouts by project file name.
declare module 'virtual:layouts' {
  const layouts: Record<string, unknown>
  export default layouts
}

declare module 'virtual:image-widths' {
  const widths: Record<string, [number, number]>
  export default widths
}
