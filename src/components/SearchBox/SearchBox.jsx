import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import styles from './SearchBox.module.css'

/**
 * 頁首的文字搜尋框：每一頁都看得到
 *   在首頁打字 → 直接篩選首頁的物種（搜尋字存在網址的 q）
 *   在其他頁打字 → 跳回首頁並帶著搜尋字，例如 /?q=藍鵲
 * 停止打字 0.3 秒後才更新網址，避免每打一個字就重新篩選、瀏覽紀錄也不會被灌滿
 */
export default function SearchBox({ className = '' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const onHome = location.pathname === '/'
  const urlQuery = onHome ? (searchParams.get('q') ?? '') : ''

  const [query, setQuery] = useState(urlQuery)

  // 網址的搜尋字被別的方式改掉時（例如按「上一頁」、離開首頁），搜尋框跟著更新
  useEffect(() => setQuery(urlQuery), [urlQuery])

  useEffect(() => {
    if (query === urlQuery) return
    const timer = setTimeout(() => {
      if (onHome) {
        // 在首頁：只改搜尋字，保留目前的分頁、主題、外觀篩選
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            if (query.trim()) next.set('q', query)
            else next.delete('q')
            return next
          },
          { replace: true },
        )
      } else if (query.trim()) {
        navigate(`/?q=${encodeURIComponent(query)}`)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    // 送出表單不需要做任何事（打字時就會自動搜尋），只是讓手機鍵盤出現「搜尋」鍵
    <form className={`${styles.search} ${className}`} role="search" onSubmit={(event) => event.preventDefault()}>
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M16.5 16.5 21 21" />
      </svg>
      <input
        type="search"
        className={styles.input}
        placeholder="搜尋名稱，例如：藍鵲、台灣 蛙"
        aria-label="搜尋物種名稱（可用空格隔開多個關鍵字）"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
    </form>
  )
}
