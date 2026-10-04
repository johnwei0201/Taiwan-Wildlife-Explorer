import { useEffect, useState } from 'react'
import SpeciesCard from '../../components/SpeciesCard/SpeciesCard.jsx'
import { GROUPS } from '../../constants/groups.js'
import styles from './HomePage.module.css'

export default function HomePage() {
  const [speciesList, setSpeciesList] = useState([])
  const [status, setStatus] = useState('loading') // loading 載入中 / success 成功 / error 失敗
  const [activeGroup, setActiveGroup] = useState('all')

  // 頁面第一次出現時，讀取資料腳本產生的 JSON（放在 public/ 的檔案可以直接用網址讀）
  useEffect(() => {
    fetch('/data/species-list.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setSpeciesList(data)
        setStatus('success')
      })
      .catch(() => setStatus('error'))
  }, [])

  const filteredSpecies =
    activeGroup === 'all'
      ? speciesList
      : speciesList.filter((species) => species.group === activeGroup)

  return (
    <div className="container">
      <section className={styles.hero}>
        <h1 className={styles.title}>發現台灣動物趣</h1>
        <p className={styles.subtitle}>探索台灣的鳥類、哺乳類、爬蟲類與兩棲類</p>
      </section>

      {/* 類群切換：手機可以左右滑動，平板以上會自動換行 */}
      <div className={styles.tabs} role="tablist" aria-label="動物類群">
        {GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={activeGroup === group.id}
            className={styles.tab}
            onClick={() => setActiveGroup(group.id)}
          >
            {group.label}
          </button>
        ))}
      </div>

      {status === 'loading' && <p className={styles.message}>資料載入中…</p>}
      {status === 'error' && <p className={styles.message}>資料載入失敗，請稍後再試</p>}

      {status === 'success' && (
        <>
          <p className={styles.count}>共 {filteredSpecies.length} 種</p>
          <ul className={styles.grid}>
            {filteredSpecies.map((species) => (
              <li key={species.id}>
                <SpeciesCard species={species} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
