import { useState } from 'react'
import SpeciesCard from '../../components/SpeciesCard/SpeciesCard.jsx'
import { GROUPS } from '../../constants/groups.js'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import styles from './HomePage.module.css'

export default function HomePage() {
  const { speciesList, status } = useSpeciesList()
  const [activeGroup, setActiveGroup] = useState('all')

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
