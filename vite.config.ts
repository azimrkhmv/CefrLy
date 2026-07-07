import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Exam source material (audio, PDFs, papers) — NOT app source. Windows
      // locks in-use media files, which crashes Vite's watcher with EBUSY
      // (e.g. an open speaking Test PDF). Keep these folders out of the watch.
      ignored: ['**/listening sample/**', '**/reading samples/**', '**/samples/**'],
    },
  },
})
