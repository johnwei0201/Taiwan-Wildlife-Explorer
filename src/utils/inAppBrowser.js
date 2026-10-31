// App 內建的瀏覽器（在 LINE、Facebook 等 App 裡點連結時開啟的網頁）
//   Google 基於安全理由，禁止在這種瀏覽器裡登入（App 有機會偷看帳號密碼），按下登入按鈕會沒有反應
//   所以要先認出來，提示訪客改用 Safari 或 Chrome

// 用 User-Agent（瀏覽器送出的身分字串）判斷；這些 App 都會在裡面加上自己的名稱
const IN_APP_BROWSERS = [
  { name: 'LINE', pattern: /\bLine\/\d/i },
  { name: 'Facebook', pattern: /FBAN|FBAV|FB_IAB/ },
  { name: 'Instagram', pattern: /Instagram/ },
  { name: 'Threads', pattern: /Barcelona/ }, // Threads 開發時的代號
  { name: '微信', pattern: /MicroMessenger/ },
]

// 回傳 App 名稱；一般的瀏覽器回傳 null
export function detectInAppBrowser(userAgent = navigator.userAgent) {
  return IN_APP_BROWSERS.find((app) => app.pattern.test(userAgent))?.name ?? null
}

// LINE 官方提供的功能：網址加上 openExternalBrowser=1，LINE 會改用手機的預設瀏覽器開啟
export function lineExternalUrl(href = window.location.href) {
  const url = new URL(href)
  url.searchParams.set('openExternalBrowser', '1')
  return url.toString()
}
