import { useEffect, useRef, useState } from 'react'

// 「使用 Google 帳號登入」按鈕：Google 官方的 Google Identity Services（GIS）
//   使用者按下後在 Google 的視窗登入，Google 把簽好名的 ID token 交給 onCredential，再送到後端驗證
//   按鈕由 Google 的程式畫出來（樣式、文字都是 Google 規定的），這裡只提供放按鈕的位置

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'
let scriptPromise = null // 整個網站只載入一次

function loadGoogleScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve(window.google)
    script.onerror = () => {
      scriptPromise = null // 載入失敗時允許下次重試
      reject(new Error('Google 登入載入失敗'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export default function GoogleSignInButton({ clientId, onCredential }) {
  const containerRef = useRef(null)
  const callbackRef = useRef(onCredential)
  const [failed, setFailed] = useState(false)

  // 用 ref 存最新的 callback：callback 改變時不用重新畫按鈕
  useEffect(() => {
    callbackRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    let cancelled = false
    loadGoogleScript()
      .then((google) => {
        if (cancelled || !containerRef.current) return
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current(response.credential),
        })
        google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          locale: 'zh-TW',
        })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (failed) return <p role="alert">Google 登入按鈕載入失敗，請重新整理頁面再試一次。</p>
  return <div ref={containerRef} />
}
