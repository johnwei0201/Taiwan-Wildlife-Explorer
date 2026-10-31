import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 設定：讓 Vite 看得懂 React 的 JSX 語法
export default defineConfig({
  plugins: [react()],
  server: {
    // 本機開發：/api 轉給 backend/serve_local.py（線上由 Vercel 的 api/*.py 處理）
    //   xfwd：加上 X-Forwarded-Host 等標頭，後端才知道原本的網址是 localhost:5173（和 Vercel 一樣），
    //   會員 API 檢查「請求是不是從本站送出的」時才不會誤判
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true, xfwd: true } },
  },
})
