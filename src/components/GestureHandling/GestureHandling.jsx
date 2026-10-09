import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-leaflet'
import styles from './GestureHandling.module.css'

// Mac 用 ⌘、其他系統用 Ctrl
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform)
const HINTS = {
  wheel: IS_MAC ? '按住 ⌘ 再滾動滑鼠滾輪，即可縮放地圖' : '按住 Ctrl 再滾動滑鼠滾輪，即可縮放地圖',
  touch: '使用兩指移動、縮放地圖',
}
const HINT_DURATION_MS = 1500

/**
 * 協同手勢（和 Google 地圖嵌入網頁時的做法一樣）：避免使用者只是想捲動網頁，卻不小心操作到地圖
 *   桌機：一般滾輪 → 捲動網頁；按住 Ctrl（Mac 是 ⌘）＋滾輪 → 縮放地圖
 *         （觸控板兩指開合，瀏覽器會當成 Ctrl＋滾輪送出，所以照樣可以縮放）
 *   手機：一指 → 捲動網頁；兩指 → 移動、縮放地圖
 *   點一下地圖不受影響（例如「我附近的動物」點地圖選位置）
 * 放在 <MapContainer> 裡面使用
 */
export default function GestureHandling() {
  const map = useMap()
  const [hint, setHint] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    const container = map.getContainer()

    const showHint = (type) => {
      setHint(type)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setHint(null), HINT_DURATION_MS)
    }

    // 桌機滾輪：在「捕獲階段」先攔下來，沒按 Ctrl／⌘ 就不讓事件傳到 Leaflet
    //   Leaflet 收不到 → 不會縮放，也不會擋掉預設行為 → 瀏覽器照常捲動網頁
    const onWheel = (event) => {
      if (event.ctrlKey || event.metaKey) return
      event.stopPropagation()
      showHint('wheel')
    }

    // 手機：關掉地圖的單指拖動
    //   Leaflet 拖動開著時，地圖會設定 touch-action: none（瀏覽器不捲動、全部交給地圖），
    //   關掉後剩下 pan-x pan-y：一指交給瀏覽器捲動網頁；兩指開合仍由 Leaflet 的觸控縮放處理（也會跟著移動地圖）
    const isTouch = window.matchMedia('(pointer: coarse)').matches
    if (isTouch) map.dragging.disable()

    const onTouchStart = (event) => {
      if (event.touches.length === 1) showHint('touch')
      else setHint(null)
    }

    container.addEventListener('wheel', onWheel, { capture: true })
    if (isTouch) container.addEventListener('touchstart', onTouchStart, { passive: true })

    return () => {
      container.removeEventListener('wheel', onWheel, { capture: true })
      container.removeEventListener('touchstart', onTouchStart)
      if (isTouch) map.dragging.enable()
      clearTimeout(timerRef.current)
    }
  }, [map])

  // 提示疊在地圖上；pointer-events: none，不會擋到地圖的點擊
  return (
    <div className={styles.hint} data-visible={hint !== null} aria-hidden="true">
      <span className={styles.text}>{hint && HINTS[hint]}</span>
    </div>
  )
}
