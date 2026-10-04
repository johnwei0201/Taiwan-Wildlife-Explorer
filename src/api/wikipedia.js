// 中文維基百科摘要（免金鑰、允許瀏覽器直接呼叫）
// Accept-Language: zh-tw → 維基百科會自動轉成台灣正體中文
const WIKI_API = 'https://zh.wikipedia.org/api/rest_v1/page/summary'
const WIKI_ACTION_API = 'https://zh.wikipedia.org/w/api.php'

const convertCache = new Map()

/**
 * 簡體 → 台灣正體中文：借用維基百科的「繁簡轉換」功能
 * 把文字交給維基百科解析並指定 variant=zh-tw，回傳的內容就是轉換後的正體中文
 * 失敗時回傳原文，不影響畫面顯示
 */
export async function toTraditional(text) {
  if (convertCache.has(text)) return convertCache.get(text)
  try {
    // 用 POST 傳送：簡介可能很長，放在網址裡會超過長度限制
    const body = new URLSearchParams({
      action: 'parse',
      format: 'json',
      formatversion: '2',
      contentmodel: 'wikitext',
      variant: 'zh-tw',
      prop: 'text',
      disablelimitreport: '1',
      text,
    })
    const res = await fetch(`${WIKI_ACTION_API}?origin=*`, { method: 'POST', body })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    // 回傳的是 HTML，取出純文字（DOMParser 也會順便把 &amp; 這類符號還原）
    const html = data.parse?.text ?? ''
    const converted = new DOMParser().parseFromString(html, 'text/html').body.textContent.trim()
    const result = converted || text
    convertCache.set(text, result)
    return result
  } catch {
    return text
  }
}

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
