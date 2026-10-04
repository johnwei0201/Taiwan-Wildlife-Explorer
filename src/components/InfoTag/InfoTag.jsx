import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import styles from './InfoTag.module.css'

const SCREEN_MARGIN = 12 // 彈窗離螢幕邊緣至少保留的距離

/**
 * 可以看說明的標籤
 *   電腦：滑鼠移上去就出現說明，移開就消失
 *   手機：手指點一下打開，再點一次、點其他地方或按 Esc 關閉
 *
 * label：標籤文字　title：彈窗標題　className：標籤顏色　children：彈窗內容
 */
export default function InfoTag({ label, title, className = '', children }) {
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const wrapRef = useRef(null)
  const popRef = useRef(null)
  const pointerType = useRef('mouse') // 記住最後一次是滑鼠還是手指，決定點擊時的行為
  const popId = useId()

  // 彈窗超出螢幕右邊時往左移，避免在手機上被切掉
  useLayoutEffect(() => {
    if (!open || !popRef.current) return
    const rect = popRef.current.getBoundingClientRect()
    const overflow = rect.right - (document.documentElement.clientWidth - SCREEN_MARGIN)
    setShift((current) => (overflow > 0 ? current - overflow : current))
  }, [open])

  // 打開時：點彈窗外面或按 Esc 就關閉
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const show = () => {
    setShift(0)
    setOpen(true)
  }

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
    >
      <button
        type="button"
        className={`${styles.tag} ${className}`}
        aria-expanded={open}
        aria-describedby={open ? popId : undefined}
        onPointerDown={(e) => {
          pointerType.current = e.pointerType
        }}
        // 滑鼠已經靠移入移出控制，點擊只處理手指和鍵盤（Enter / 空白鍵）
        onClick={() => pointerType.current !== 'mouse' && (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') pointerType.current = 'keyboard'
        }}
        onBlur={() => pointerType.current === 'keyboard' && setOpen(false)}
      >
        {label}
        <span className={styles.hint} aria-hidden="true">ⓘ</span>
      </button>

      {open && (
        <div
          ref={popRef}
          id={popId}
          role="tooltip"
          className={styles.popover}
          style={{ transform: `translateX(${shift}px)` }}
        >
          <strong className={styles.title}>{title}</strong>
          {children}
        </div>
      )}
    </div>
  )
}
