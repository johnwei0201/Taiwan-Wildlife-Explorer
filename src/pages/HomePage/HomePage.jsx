import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SpeciesCard from '../../components/SpeciesCard/SpeciesCard.jsx'
import FilterPanel from '../../components/FilterPanel/FilterPanel.jsx'
import { GROUPS } from '../../constants/groups.js'
import { FILTERS, applyFilters } from '../../constants/filters.js'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import styles from './HomePage.module.css'

const RANDOM_COUNT = 30

// 洗牌（Fisher–Yates）：從最後一張開始，每張都和前面隨機一張交換，每種排列機率相同
function shuffle(list) {
  const result = [...list]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export default function HomePage() {
  const { speciesList, status } = useSpeciesList()

  // 分頁與篩選條件存在網址上（例如 /?group=aves&color=藍）：
  // 點進物種詳細頁再按「上一頁」回來，條件還會保留
  const [searchParams, setSearchParams] = useSearchParams()
  const activeGroup = GROUPS.find((g) => g.id === searchParams.get('group')) ?? null // null＝還沒選，顯示隨機推薦
  const filters = Object.fromEntries(FILTERS.map((f) => [f.key, searchParams.get(f.key) ?? '']))

  // 一打開網頁先隨機推薦 30 種（只挑有照片的），按「換一批」重新洗牌
  const [shuffleCount, setShuffleCount] = useState(0)
  const randomSpecies = useMemo(
    () => shuffle(speciesList.filter((s) => s.photo)).slice(0, RANDOM_COUNT),
    // shuffleCount 改變時重新洗牌
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [speciesList, shuffleCount],
  )

  // 切換分頁時清空篩選條件（不同類群的選項不一樣）
  const selectGroup = (groupId) => setSearchParams({ group: groupId })

  const changeFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    // replace：調整篩選不新增瀏覽紀錄，按「上一頁」不會一格一格退回去
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => setSearchParams({ group: activeGroup.id }, { replace: true })

  const showFilters = activeGroup?.kind === 'group'
  const groupSpecies = activeGroup ? speciesList.filter(activeGroup.match) : []
  const filteredSpecies = showFilters ? applyFilters(groupSpecies, filters) : groupSpecies

  return (
    <div className="container">
      <section className={styles.hero}>
        <h1 className={styles.title}>發現台灣動物趣</h1>
        <p className={styles.subtitle}>探索台灣的鳥類、哺乳類、爬蟲類與兩棲類</p>
      </section>

      {/* 分頁：手機可以左右滑動，平板以上會自動換行 */}
      <div className={styles.tabs} role="tablist" aria-label="動物分類">
        {GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={activeGroup?.id === group.id}
            data-kind={group.kind}
            className={styles.tab}
            onClick={() => selectGroup(group.id)}
          >
            {group.label}
          </button>
        ))}
      </div>

      {/* 選了類群才出現外觀篩選；key 讓切換類群時重新播放出現動畫 */}
      {status === 'success' && showFilters && (
        <FilterPanel
          key={activeGroup.id}
          list={groupSpecies}
          group={activeGroup.id}
          filters={filters}
          onChange={changeFilter}
          onClear={clearFilters}
        />
      )}

      {status === 'loading' && <p className={styles.message}>資料載入中…</p>}
      {status === 'error' && <p className={styles.message}>資料載入失敗，請稍後再試</p>}

      {/* 還沒選分頁：隨機推薦 */}
      {status === 'success' && !activeGroup && (
        <>
          <div className={styles.randomHeader}>
            <p className={styles.count}>
              隨機推薦 {randomSpecies.length} 種（全台共 {speciesList.length} 種，點上方分類看更多）
            </p>
            <button
              type="button"
              className={styles.shuffle}
              onClick={() => setShuffleCount((n) => n + 1)}
            >
              🔀 換一批
            </button>
          </div>
          <SpeciesGrid list={randomSpecies} />
        </>
      )}

      {/* 已選分頁 */}
      {status === 'success' && activeGroup && (
        <>
          <p className={styles.count}>
            共 {filteredSpecies.length} 種
            {filteredSpecies.length < groupSpecies.length && `（從 ${groupSpecies.length} 種中篩選）`}
          </p>
          {filteredSpecies.length === 0 ? (
            <p className={styles.message}>沒有符合條件的動物，試著減少一些條件</p>
          ) : (
            <SpeciesGrid list={filteredSpecies} />
          )}
        </>
      )}
    </div>
  )
}

function SpeciesGrid({ list }) {
  return (
    <ul className={styles.grid}>
      {list.map((species) => (
        <li key={species.id}>
          <SpeciesCard species={species} />
        </li>
      ))}
    </ul>
  )
}
