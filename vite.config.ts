import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // content drops (audio samples, PDFs) — not source; Windows locks on
      // in-use media files crash the watcher with EBUSY
      ignored: ['**/listening sample/**'],
    },
  },
})
