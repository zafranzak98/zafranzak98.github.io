import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import contentCollections from '@content-collections/vite'
import sharp from 'sharp'
import { isPhoto } from './src/lib/image-variants.js'

// Responsive images: the width of every photo in public/media, so each image on a page can list
// the smaller copies the build makes of it (see src/lib/image-variants.js).
function imageWidths(): Plugin {
  const id = 'virtual:image-widths'
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
  return {
    name: 'image-widths',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    async load(resolved) {
      if (resolved !== `\0${id}`) return
      const widths: Record<string, number> = {}
      for (const file of walk('public/media').filter(isPhoto)) {
        const { width } = await sharp(file).metadata()
        if (width) widths[`/${relative('public', file).split('\\').join('/')}`] = width
      }
      return `export default ${JSON.stringify(widths)}`
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    contentCollections(),
    imageWidths(),
  ],
})

export default config
