// 中文維基百科摘要（免金鑰、允許瀏覽器直接呼叫）
// Accept-Language: zh-tw → 維基百科會自動轉成台灣正體中文
const WIKI_API = 'https://zh.wikipedia.org/api/rest_v1/page/summary'

// 查過的就記起來，同一頁重複點「？」不用再查一次
const cache = new Map()

// 用學名查詢（例如 Ardeidae），維基百科會自動導向中文條目「鷺科」
export async function fetchWikiSummary(title) {
  if (cache.has(title)) return cache.get(title)

  const res = await fetch(`${WIKI_API}/${encodeURIComponent(title)}`, {
    headers: { 'Accept-Language': 'zh-tw' },
  })
  if (res.status === 404) {
    cache.set(title, null)
    return null
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data = await res.json()
  // 消歧義頁（同名的多個條目）沒有實際內容，當作查不到
  const result =
    data.type === 'disambiguation' || !data.extract
      ? null
      : { extract: data.extract, url: data.content_urls?.desktop?.page ?? null }
  cache.set(title, result)
  return result
}
