import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AccountError } from '../../api/account.js'
import { useAccount } from '../../hooks/useAccount.jsx'
import styles from './CollectionButtons.module.css'

const BUTTONS = [{ list: 'favorite', on: '♥ 已收藏', off: '♡ 收藏', hint: '收藏這種動物' }]

// 物種介紹頁的會員功能：已登入時自動記錄成「看過的動物」，並顯示收藏按鈕；沒登入時提示到會員頁登入
//   會員功能還沒開放（沒有 Client ID）或後端無法使用時，整塊不顯示
export default function CollectionButtons({ speciesId }) {
  const { status, user, clientId, collection, toggle, markSeen } = useAccount()
  const [pending, setPending] = useState(null) // 正在送出的清單名稱

  // 打開這一頁就記錄（清單載入後才知道是否已經記錄過）
  useEffect(() => {
    if (user && collection) markSeen(speciesId)
  }, [user, collection, speciesId, markSeen])

  if (status !== 'ready' || !clientId) return null

  if (!user) {
    return (
      <p className={styles.signInHint}>
        <Link to="/account">登入會員</Link>，看過的動物會自動記錄下來
      </p>
    )
  }

  const handleClick = async (list) => {
    setPending(list)
    try {
      await toggle(speciesId, list)
    } catch (err) {
      alert(err instanceof AccountError ? err.message : '操作失敗，請再試一次。')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className={styles.buttons}>
      {BUTTONS.map(({ list, on, off, hint }) => {
        const active = Boolean(collection?.[list].includes(speciesId))
        return (
          <button
            key={list}
            type="button"
            className={styles.button}
            aria-pressed={active}
            title={hint}
            onClick={() => handleClick(list)}
            disabled={!collection || pending !== null}
          >
            {active ? on : off}
          </button>
        )
      })}
    </div>
  )
}
