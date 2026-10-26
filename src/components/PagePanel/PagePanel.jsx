import styles from './PagePanel.module.css'

// 頁面上方的區塊：淡綠色標題列＋白底內容（和「用外型找找」面板同一種風格）
//   「我附近的動物」「AI 動物通」共用，兩頁的樣式才會一致
//   title：頁面標題（h1，每頁只有一個）；badge：標題右邊的小標籤（可省略）
export default function PagePanel({ title, badge, children, className = '' }) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <div className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {badge && <span className={styles.badge}>{badge}</span>}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  )
}
