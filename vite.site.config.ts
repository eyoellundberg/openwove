import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The marketing site: `npm run site`. It shares the app's theme and shadcn components through `@/`.
export default defineConfig({
  root: path.resolve(import.meta.dirname, 'site'),
  // The same icons as the app, so there's one copy of the mark to keep.
  publicDir: path.resolve(import.meta.dirname, 'public'),
  plugins: [
    react(),
    tailwindcss(),
    {
      // The share card is only for the site, so it's emitted into the build instead of living in the shared public/ folder.
      name: 'og-image',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'og.png', source: readFileSync(path.resolve(import.meta.dirname, 'site/og/og.png')) })
      },
    },
  ],
  build: { outDir: path.resolve(import.meta.dirname, 'dist-site'), emptyOutDir: true },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
