import styles from './ChatMessage.module.css'

// 一則對話：使用者的問題靠右（綠底），AI 的回答靠左（淡綠底）
//   loading：AI 思考中，顯示跳動的三個點
//   children：回答下方的附加內容（參考資料卡片、延伸問題）
export default function ChatMessage({ role, text, loading = false, children }) {
  const isUser = role === 'user'

  return (
    <li className={styles.row} data-role={role}>
      <div className={styles.message}>
        {!isUser && <span className={styles.speaker}>AI 動物通</span>}
        <div className={styles.bubble}>
          {loading ? (
            <span className={styles.dots} role="status" aria-label="AI 正在思考">
              <span />
              <span />
              <span />
            </span>
          ) : (
            text
          )}
        </div>
        {children}
      </div>
    </li>
  )
}
