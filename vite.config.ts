import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The local runner (npm run runner). Event streams pass straight through.
    proxy: { '/api': { target: 'http://localhost:5189', rewrite: (path) => path.replace(/^\/api/, '') } },
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
