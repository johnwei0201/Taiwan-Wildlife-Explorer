import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AccountError } from '../../api/account.js'
import { useAccount } from '../../hooks/useAccount.jsx'
import styles from './CollectionButtons.module.css'

const BUTTONS = [
  { list: 'seen', on: '✓ 看過', off: '看過', hint: '加入生命清單：在野外看過這種動物' },
  { list: 'favorite', on: '♥ 已收藏', off: '♡ 收藏', hint: '收藏這種動物' },
]

// 物種介紹頁的「看過」「收藏」按鈕：已登入時直接切換；沒登入時提示到會員頁登入
//   會員功能還沒開放（沒有 Client ID）或後端無法使用時，整塊不顯示
export default function CollectionButtons({ speciesId }) {
  const { status, user, clientId, collection, toggle } = useAccount()
  const [pending, setPending] = useState(null) // 正在送出的清單名稱

  if (status !== 'ready' || !clientId) return null

  if (!user) {
    return (
      <p className={styles.signInHint}>
        <Link to="/account">登入會員</Link>，就能把看過的動物記在生命清單裡
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
