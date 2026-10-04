import styles from './MonthChart.module.css'

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

// 月份出現分布長條圖：純 CSS 畫，不需要額外安裝圖表套件
export default function MonthChart({ counts }) {
  const values = MONTHS.map((month) => counts[month] ?? 0)
  const max = Math.max(...values)

  if (max === 0) return <p className={styles.empty}>台灣目前沒有足夠的紀錄</p>

  const peakMonth = values.indexOf(max) + 1

  return (
    <figure className={styles.figure}>
      <ul className={styles.chart}>
        {values.map((value, index) => (
          <li key={index} className={styles.column}>
            <span className={styles.value}>{value}</span>
            <span className={styles.track}>
              <span
                className={styles.bar}
                data-peak={index + 1 === peakMonth}
                style={{ height: `${(value / max) * 100}%` }}
              />
            </span>
            <span className={styles.month}>{index + 1}月</span>
            <span className="visually-hidden">：{value} 筆紀錄</span>
          </li>
        ))}
      </ul>
      <figcaption className={styles.caption}>
        最常被記錄的月份：<strong>{peakMonth} 月</strong>
      </figcaption>
    </figure>
  )
}
