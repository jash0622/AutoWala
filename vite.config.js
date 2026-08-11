import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    // Three.js is lazy-loaded (see App.jsx); splitting the vendors keeps the
    // first paint chunk small enough to feel instant.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          three: ['three', '@react-three/fiber'],
          motion: ['framer-motion', 'gsap'],
        },
      },
    },
  },
})
