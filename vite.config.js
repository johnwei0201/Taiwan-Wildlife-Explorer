import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 設定：讓 Vite 看得懂 React 的 JSX 語法
export default defineConfig({
  plugins: [react()],
})
