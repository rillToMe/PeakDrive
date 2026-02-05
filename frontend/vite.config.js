import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5133',
        changeOrigin: true,
      },
      '^/s/': {
        target: 'http://localhost:5133',
        changeOrigin: true,
      },
      '/storage': {
        target: 'http://localhost:5133',
        changeOrigin: true,
      },
    },
  },
})
