import { Link } from 'react-router-dom'
import arrowIcon from '../../assets/icons/arrow.png'
import styles from './BackLink.module.css'

// 「回到圖鑑」連結：物種詳細頁、分類頁共用，放在內容的右上角
//   箭頭圖示 alt 留空：連結已經有文字，圖示只是裝飾，螢幕閱讀器不需要再唸一次
export default function BackLink() {
  return (
    <div className={styles.row}>
      <Link to="/" className={styles.link}>
        <img src={arrowIcon} alt="" className={styles.icon} />
        回到圖鑑
      </Link>
    </div>
  )
}
