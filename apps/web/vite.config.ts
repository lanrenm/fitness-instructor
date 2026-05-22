import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/bff': {
        target: 'http://host.docker.internal:3000',
        changeOrigin: true,
      },
      '/users': {
        target: 'http://host.docker.internal:3001',
        changeOrigin: true,
      },
    },
  },
})