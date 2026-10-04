import pinIcon from '../../assets/icons/location-pin.png'
import styles from './LocationIcon.module.css'

// 定位圖示（紅色地標），用在「我的位置」等按鈕前面
// 原始黑色檔案：assets/icons/location-pin-original.png
// alt 留空：按鈕已經有文字說明，圖示只是裝飾，螢幕閱讀器不需要再唸一次
export default function LocationIcon() {
  return <img src={pinIcon} alt="" className={styles.icon} />
}
