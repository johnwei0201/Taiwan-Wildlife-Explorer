// 會員：Google 登入、生命清單、收藏
//
//   後端：api/auth.py、api/collection.py（Vercel Python Function），和網站同一個網域
//   登入狀態存在 HttpOnly cookie，JavaScript 讀不到，fetch 同網域時瀏覽器會自動帶上

// 給使用者看的錯誤：訊息可以直接顯示在畫面上
export class AccountError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(url, options = {}) {
  let res
  try {
    res = await fetch(url, {
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new AccountError('連不上伺服器，請檢查網路後再試一次。', 0)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new AccountError(data?.detail ?? '暫時無法使用，請稍後再試。', res.status)
  return data
}

// 目前登入的會員（沒登入是 null），以及 Google 登入用的 Client ID（還沒設定是 null）
export const fetchSession = () => request('/api/auth')

// credential：Google 登入按鈕給的 ID token，後端會驗證是 Google 發的
export const login = (credential) => request('/api/auth', { method: 'POST', body: JSON.stringify({ credential }) })

export const logout = () => request('/api/auth', { method: 'DELETE' })

export const deleteAccount = () => request('/api/auth?scope=account', { method: 'DELETE' })

// { seen: [物種 id], favorite: [物種 id], groups: [{ code, name, seen, total, endemicSeen, endemicTotal }] }
export const fetchCollection = () => request('/api/collection')

// list：'seen'（生命清單：在野外看過）或 'favorite'（收藏）；都回傳更新後的清單
export const addToCollection = (speciesId, list) =>
  request('/api/collection', { method: 'POST', body: JSON.stringify({ speciesId, list }) })

export const removeFromCollection = (speciesId, list) =>
  request(`/api/collection?speciesId=${speciesId}&list=${list}`, { method: 'DELETE' })
