import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split the rarely-changing libraries out of the app chunk so a normal
        // deploy doesn't bust the cached vendor code. Routes are already
        // code-split via React.lazy in App.tsx.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    watch: {
      // Exam source material (audio, PDFs, papers) — NOT app source. Windows
      // locks in-use media files, which crashes Vite's watcher with EBUSY
      // (e.g. an open speaking Test PDF). Keep these folders out of the watch.
      ignored: ['**/listening sample/**', '**/reading samples/**', '**/samples/**'],
    },
  },
})
