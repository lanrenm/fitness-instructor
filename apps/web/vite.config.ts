import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // BFF 服务 - 项目 API 和页面渲染
      '/bff': {
        target: 'http://host.docker.internal:3000',
        changeOrigin: true,
      },
      // API 服务 - 用户 API
      '/users': {
        target: 'http://host.docker.internal:3001',
        changeOrigin: true,
      },
    },
  },
})