import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The marketing site: `npm run site`. It shares the app's theme and shadcn components through `@/`.
export default defineConfig({
  root: path.resolve(import.meta.dirname, 'site'),
  plugins: [react(), tailwindcss()],
  build: { outDir: path.resolve(import.meta.dirname, 'dist-site'), emptyOutDir: true },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
