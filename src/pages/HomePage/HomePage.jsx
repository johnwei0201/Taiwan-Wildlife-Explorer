import { useSearchParams } from 'react-router-dom'
import SpeciesCard from '../../components/SpeciesCard/SpeciesCard.jsx'
import FilterPanel from '../../components/FilterPanel/FilterPanel.jsx'
import { GROUPS } from '../../constants/groups.js'
import { FILTERS, applyFilters } from '../../constants/filters.js'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import styles from './HomePage.module.css'

export default function HomePage() {
  const { speciesList, status } = useSpeciesList()

  // 類群與篩選條件存在網址上（例如 /?group=aves&color=藍）：
  // 點進物種詳細頁再按「上一頁」回來，條件還會保留
  const [searchParams, setSearchParams] = useSearchParams()
  const activeGroup = searchParams.get('group') ?? 'all'
  const filters = Object.fromEntries(FILTERS.map((f) => [f.key, searchParams.get(f.key) ?? '']))

  // 切換類群時清空篩選條件（不同類群的選項不一樣）
  const selectGroup = (groupId) => {
    setSearchParams(groupId === 'all' ? {} : { group: groupId })
  }

  const changeFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    // replace：調整篩選不新增瀏覽紀錄，按「上一頁」不會一格一格退回去
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => setSearchParams({ group: activeGroup }, { replace: true })

  const groupSpecies =
    activeGroup === 'all'
      ? speciesList
      : speciesList.filter((species) => species.group === activeGroup)
  const filteredSpecies = activeGroup === 'all' ? groupSpecies : applyFilters(groupSpecies, filters)

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
            onClick={() => selectGroup(group.id)}
          >
            {group.label}
          </button>
        ))}
      </div>

      {/* 選了特定類群才出現外觀篩選；key 讓切換類群時重新播放出現動畫 */}
      {status === 'success' && activeGroup !== 'all' && (
        <FilterPanel
          key={activeGroup}
          list={groupSpecies}
          group={activeGroup}
          filters={filters}
          onChange={changeFilter}
          onClear={clearFilters}
        />
      )}

      {status === 'loading' && <p className={styles.message}>資料載入中…</p>}
      {status === 'error' && <p className={styles.message}>資料載入失敗，請稍後再試</p>}

      {status === 'success' && (
        <>
          <p className={styles.count}>
            共 {filteredSpecies.length} 種
            {filteredSpecies.length < groupSpecies.length && `（從 ${groupSpecies.length} 種中篩選）`}
          </p>
          {filteredSpecies.length === 0 ? (
            <p className={styles.message}>沒有符合條件的動物，試著減少一些條件</p>
          ) : (
            <ul className={styles.grid}>
              {filteredSpecies.map((species) => (
                <li key={species.id}>
                  <SpeciesCard species={species} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
