import { Outlet } from 'react-router-dom'
import Header from '../Header/Header.jsx'
import Footer from '../Footer/Footer.jsx'
import styles from './Layout.module.css'

// 共用版型：頁首 + 頁面內容 + 頁尾
// <Outlet /> 是「挖一個洞」，目前網址對應的頁面會被放進這個洞
export default function Layout() {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
