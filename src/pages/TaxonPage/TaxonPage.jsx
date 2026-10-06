import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import SpeciesGrid from '../../components/SpeciesGrid/SpeciesGrid.jsx'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import { matchQuery, parseQuery, searchText } from '../../utils/search.js'
import { RANK_ORDER, TAXON_RANKS, cleanZh, filterByTaxon, taxonPath } from '../../utils/taxon.js'
import styles from './TaxonPage.module.css'

/**
 * 分類頁：/taxon/:rank/:name，例如 /taxon/family/Tetraodontidae（四齒魨科）
 *   - 上方路徑：綱 › 目 › 科 › 屬，每一層都可以點，往上看更大的分類
 *   - 下一層：這個分類底下有哪些更小的分類（例如目 → 各科），附上種數，往下細看
 *   - 搜尋框：只在這個分類裡搜尋
 *   - 物種卡片：網站收錄、屬於這個分類的所有物種
 */
export default function TaxonPage() {
  const { rank, name } = useParams()
  const { state } = useLocation()
  const { speciesList, status } = useSpeciesList()
  const config = TAXON_RANKS[rank]

  const members = useMemo(() => filterByTaxon(speciesList, rank, name), [speciesList, rank, name])
  const sample = members[0] // 同一個分類的物種，上層分類都一樣，拿第一個來看就好

  // 中文名：從物種詳細頁點過來時有帶（和詳細頁顯示的一致），直接開網址時改從資料裡找
  const nameZh = cleanZh(state?.nameZh) ?? (sample && config ? cleanZh(config.getZh(sample)) : null)

  // 往上的路徑，例如科 → [綱, 目]
  const ancestors = sample
    ? RANK_ORDER.slice(0, RANK_ORDER.indexOf(rank)).map((r) => ({
        rank: r,
        nameSci: TAXON_RANKS[r].get(sample),
        nameZh: cleanZh(TAXON_RANKS[r].getZh(sample)),
      }))
    : []

  // 往下一層：把成員依下一層分組並計算種數，種數多的排前面
  const childRank = config?.child
  const children = useMemo(() => {
    if (!childRank) return []
    const groups = new Map()
    for (const s of members) {
      const key = TAXON_RANKS[childRank].get(s)
      const group = groups.get(key) ?? { nameSci: key, nameZh: cleanZh(TAXON_RANKS[childRank].getZh(s)), count: 0 }
      group.count++
      groups.set(key, group)
    }
    return [...groups.values()].sort((a, b) => b.count - a.count)
  }, [members, childRank])

  // 分類內搜尋：換到別的分類時清空
  const [query, setQuery] = useState('')
  useEffect(() => setQuery(''), [rank, name])
  const terms = parseQuery(query)
  const filtered = terms.length > 0 ? members.filter((s) => matchQuery(searchText(s), terms)) : members

  const title = nameZh ?? name
  useEffect(() => {
    document.title = `${title}｜發現台灣動物趣`
    return () => {
      document.title = '發現台灣動物趣 Taiwan Wildlife Explorer'
    }
  }, [title])

  if (!config) {
    return (
      <div className="container">
        <p className={styles.message}>找不到這個分類</p>
      </div>
    )
  }

  return (
    <div className="container">
      <Link to="/" className={styles.back}>
        ← 回到圖鑑
      </Link>

      {/* 往上的路徑：綱 › 目 › 科（目前這一層不是連結） */}
      {ancestors.length > 0 && (
        <nav aria-label="分類路徑">
          <ol className={styles.path}>
            {ancestors.map((a) => (
              <li key={a.rank}>
                <Link to={taxonPath(a.rank, a.nameSci)} state={{ nameZh: a.nameZh }}>
                  {a.nameZh ?? a.nameSci}
                </Link>
              </li>
            ))}
            <li aria-current="page">{title}</li>
          </ol>
        </nav>
      )}

      <header className={styles.hero}>
        <p className={styles.rank}>{config.label}</p>
        <h1 className={styles.title}>
          {nameZh && <>{nameZh} </>}
          <span className={`scientific-name ${styles.sci}`}>{name}</span>
        </h1>
        {status === 'success' && members.length > 0 && (
          <p className={styles.summary}>網站收錄這個{config.label}的動物共 {members.length} 種</p>
        )}
      </header>

      {status === 'loading' && <p className={styles.message}>資料載入中…</p>}
      {status === 'error' && <p className={styles.message}>資料載入失敗，請稍後再試</p>}
      {status === 'success' && members.length === 0 && (
        <p className={styles.message}>網站目前沒有收錄這個分類的動物</p>
      )}

      {/* 往下一層：例如「這個目底下的科」 */}
      {children.length > 1 && (
        <section className={styles.children} aria-labelledby="children-title">
          <h2 id="children-title" className={styles.childrenTitle}>
            這個{config.label}底下的{TAXON_RANKS[childRank].label}
          </h2>
          <ul className={styles.chips}>
            {children.map((c) => (
              <li key={c.nameSci}>
                <Link
                  to={taxonPath(childRank, c.nameSci)}
                  state={{ nameZh: c.nameZh }}
                  className={styles.chip}
                >
                  {c.nameZh ?? <span className="scientific-name">{c.nameSci}</span>}
                  <span className={styles.chipCount}>{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {members.length > 0 && (
        <>
          {/* 只在這個分類裡搜尋（規則和頁首的搜尋一樣：空格隔開多個關鍵字） */}
          <form className={styles.search} role="search" onSubmit={(event) => event.preventDefault()}>
            <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M16.5 16.5 21 21" />
            </svg>
            <input
              type="search"
              className={styles.searchInput}
              placeholder={`在${title}裡搜尋`}
              aria-label={`在${title}裡搜尋物種名稱`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>

          <p className={styles.count}>
            共 {filtered.length} 種{filtered.length < members.length && `（從 ${members.length} 種中篩選）`}
          </p>
          {filtered.length === 0 ? (
            <p className={styles.message}>沒有符合的動物，試試其他關鍵字</p>
          ) : (
            <SpeciesGrid list={filtered} />
          )}
        </>
      )}
    </div>
  )
}
