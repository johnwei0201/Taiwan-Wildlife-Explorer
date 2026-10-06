import { useEffect, useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import SpeciesGrid from '../../components/SpeciesGrid/SpeciesGrid.jsx'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import { RANK_ORDER, TAXON_RANKS, cleanZh, filterByTaxon, taxonPath } from '../../utils/taxon.js'
import styles from './TaxonPage.module.css'

/**
 * 分類頁：/taxon/:rank/:name，例如 /taxon/family/Tetraodontidae（四齒魨科）
 *   - 上方路徑：綱 › 目 › 科 › 屬，每一層都可以點，往上看更大的分類
 *   - 下一層：這個分類底下有哪些更小的分類（例如目 → 各科），附上種數，往下細看
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
          <p className={styles.count}>共 {members.length} 種</p>
          <SpeciesGrid list={members} />
        </>
      )}
    </div>
  )
}
