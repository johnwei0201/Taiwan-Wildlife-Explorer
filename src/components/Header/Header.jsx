import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
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
        <Link to="/" className={styles.logo} onClick={closeMenu}>
          發現台灣動物趣
          <span className={styles.logoEn}>Taiwan Wildlife Explorer</span>
        </Link>

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
      </div>
    </header>
  )
}
