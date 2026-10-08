import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import SearchBox from '../SearchBox/SearchBox.jsx'
import logoUrl from '../../assets/發現台灣動物趣_logo.png'
import styles from './Header.module.css'

const NAV_ITEMS = [
  { to: '/', label: '物種圖鑑' },
  { to: '/nearby', label: '我附近的動物' },
]

export default function Header() {
  // 手機版選單是否展開
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        {/* Logo：點了回到首頁並重新整理（用一般的 <a> 而不是 Link：
            Link 只在網站內切換畫面，已經在首頁時點了沒有反應；<a> 會重新載入，隨機推薦也會換一批） */}
        <a href="/" className={styles.logo}>
          <img src={logoUrl} alt="發現台灣動物趣 Taiwan Wildlife Explorer" className={styles.logoImage} />
        </a>

        {/* 漢堡按鈕：只在手機顯示 */}
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={isMenuOpen}
          aria-controls="main-nav"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span className="visually-hidden">{isMenuOpen ? '關閉選單' : '開啟選單'}</span>
          <span className={styles.menuIcon} data-open={isMenuOpen} aria-hidden="true" />
        </button>

        <nav id="main-nav" className={styles.nav} data-open={isMenuOpen}>
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  onClick={closeMenu}
                  className={({ isActive }) =>
                    isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* 搜尋框：手機排在第二行（整行寬），平板以上排在選單右邊 */}
        <SearchBox className={styles.search} />
      </div>
    </header>
  )
}
