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
  optimizeDeps: {
    // Mediapipe 的 wasm/worker 打包在 esbuild 里偶尔会出错，关闭预构建保持原始格式
    exclude: ['@mediapipe/face_mesh', '@mediapipe/camera_utils']
  },
  assetsInclude: ['**/*.wasm', '**/*.data'],
  build: {
    target: 'esnext'
  }
}))
