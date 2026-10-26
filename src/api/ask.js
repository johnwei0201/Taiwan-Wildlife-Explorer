// AI 動物通：向後端發問
//
//   後端：Vercel Python Function（api/ask.py），和網站同一個網域，所以直接用 /api/ask
//   本機開發：npm run dev 會把 /api 轉給 backend/serve_local.py（vite.config.js 的 proxy）
//
// 回傳格式：
//   {
//     answer: '回答文字',
//     sources: [8415, 12345],          // 參考的物種 id（畫面會用本站資料顯示成物種卡片）
//     followUps: ['延伸問題 1', '…'],   // 延伸問題按鈕
//     mode: 'ai' | 'fallback',         // fallback：AI 暫停時，只列出找到的物種
//   }

const API_URL = '/api/ask'

// 給使用者看的錯誤：訊息可以直接顯示在畫面上
export class AskError extends Error {}

export async function askQuestion(question, signal) {
  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error // 使用者離開頁面，交給呼叫的地方處理
    throw new AskError('連不上 AI 動物通，請檢查網路後再試一次。')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // 429 問太快、422 問題長度不對…後端會在 detail 說明原因
    throw new AskError(data?.detail ?? '暫時無法回答，請稍後再試。')
  }
  return data
}
