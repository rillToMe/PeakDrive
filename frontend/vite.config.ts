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
      '/share-api': {
        target: 'http://localhost:5133',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/share-api/, '/s'),
      },
      '/storage': {
        target: 'http://localhost:5133',
        changeOrigin: true,
      },
    },
  },
})
