import { useState } from 'react'
import SpeciesCard from '../../components/SpeciesCard/SpeciesCard.jsx'
import { GROUPS, MOCK_SPECIES } from '../../data/mockSpecies.js'
import styles from './HomePage.module.css'

export default function HomePage() {
  const [activeGroup, setActiveGroup] = useState('all')

  const filteredSpecies =
    activeGroup === 'all'
      ? MOCK_SPECIES
      : MOCK_SPECIES.filter((species) => species.group === activeGroup)

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

      <p className={styles.count}>共 {filteredSpecies.length} 種</p>

      <ul className={styles.grid}>
        {filteredSpecies.map((species) => (
          <li key={species.id}>
            <SpeciesCard species={species} />
          </li>
        ))}
      </ul>
    </div>
  )
}
