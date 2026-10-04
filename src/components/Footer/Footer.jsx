import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <p>
          資料來源：
          <a href="https://taicol.tw/" target="_blank" rel="noreferrer">TaiCOL 臺灣物種名錄</a>
          、
          <a href="https://www.inaturalist.org/" target="_blank" rel="noreferrer">iNaturalist</a>
        </p>
        <p className={styles.note}>照片版權屬於各攝影者，依各自的 CC 授權條款使用</p>
      </div>
    </footer>
  )
}
