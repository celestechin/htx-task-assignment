import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // in dev, send api calls to the backend so the browser only sees one address (no cors)
    // nginx does the same job in docker
    proxy: { '/api': 'http://localhost:3000' },
  },
})
