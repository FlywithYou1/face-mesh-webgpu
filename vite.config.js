import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // 开发环境使用根路径，生产环境（GitHub Pages）使用仓库名路径
  base: command === 'serve' ? '/' : '/face-mesh-webgpu/',
  server: {
    host: true
  },
  build: {
    target: 'esnext'
  }
}))
