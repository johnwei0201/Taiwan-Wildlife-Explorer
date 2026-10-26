import { useState } from 'react'
import styles from './ChatInput.module.css'

const MAX_LENGTH = 200 // 問題長度上限：避免一次送出太長的文字（也能控制 AI 的使用費用）

// 輸入框＋送出按鈕：按 Enter 或點「送出」都會送出，送出後清空輸入框
export default function ChatInput({ onSend, disabled = false }) {
  const [text, setText] = useState('')
  const trimmed = text.trim()

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        type="text"
        className={styles.input}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="問問某種動物的食性、棲地或保育等級"
        maxLength={MAX_LENGTH}
        aria-label="輸入你的問題"
      />
      <button type="submit" className={styles.send} disabled={!trimmed || disabled}>
        送出
      </button>
    </form>
  )
}
