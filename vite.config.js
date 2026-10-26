import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 設定：讓 Vite 看得懂 React 的 JSX 語法
export default defineConfig({
  plugins: [react()],
  server: {
    // 本機開發：AI 動物通的 /api/ask 轉給 backend/serve_local.py（線上由 Vercel 的 api/ask.py 處理）
    proxy: { '/api': 'http://localhost:8000' },
  },
})
