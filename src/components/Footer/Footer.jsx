import styles from './Footer.module.css'

// 網站串接的開放資料：物種與照片（iNaturalist）、官方中文名與保育等級（TaiCOL）、
// 家養動物與貓狗品種（Wikidata、維基百科）、地圖（OpenStreetMap）
const DATA_SOURCES = [
  { name: 'iNaturalist', url: 'https://www.inaturalist.org/' },
  { name: 'TaiCOL 臺灣物種名錄', url: 'https://taicol.tw/' },
  { name: 'Wikidata', url: 'https://www.wikidata.org/' },
  { name: '維基百科', url: 'https://zh.wikipedia.org/' },
  { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/' },
]

export default function Footer() {
  return (
    <footer className={`${styles.footer} jungle-bg`}>
      <div className="container">
        <p>
          資料來源：
          {DATA_SOURCES.map((source, index) => (
            <span key={source.url}>
              {index > 0 && '、'}
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.name}
              </a>
            </span>
          ))}
        </p>
        <p className={styles.note}>照片版權屬於各攝影者，依各自的 CC 授權條款使用</p>
      </div>
    </footer>
  )
}
