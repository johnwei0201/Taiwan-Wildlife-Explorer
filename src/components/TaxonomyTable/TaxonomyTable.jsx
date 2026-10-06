import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchWikiSummary } from '../../api/wikipedia.js'
import { TAXON_RANKS, cleanZh, filterByTaxon, taxonPath } from '../../utils/taxon.js'
import styles from './TaxonomyTable.module.css'

/**
 * 分類階層表（綱、目、科、屬），每一層後面有「？」按鈕
 * 點「？」會在表格下方展開說明：
 *   1. 分類小教室：界 › 門 › 綱 › 目 › 科 › 屬 › 種，每一階都可以點，切換到那一層的說明
 *   2. 這個分類（例如「鷺科」）的維基百科介紹
 *
 * 每一層最後面還有「科 12 種」：點了會到該分類的專屬頁面（/taxon/family/…）
 *
 * items：從界到種的完整分類 [{ rank, label, intro, inTable, taxon: { id, nameSci, nameZh } }]
 * speciesList：網站收錄的物種，用來計算每一層有幾種（只有自己一種時不顯示連結）
 */
export default function TaxonomyTable({ items, speciesNameSci, speciesList = [] }) {
  const [openRank, setOpenRank] = useState(null)
  const [wiki, setWiki] = useState({ status: 'idle', data: null })

  const openItem = items.find((item) => item.rank === openRank)
  const openNameSci = openItem?.taxon.nameSci

  // 打開某一層時才去查維基百科（沒點就不查，節省請求）
  useEffect(() => {
    if (!openNameSci) return
    let ignore = false // 使用者很快切到別層時，忽略舊的結果
    setWiki({ status: 'loading', data: null })
    fetchWikiSummary(openNameSci)
      .then((data) => !ignore && setWiki({ status: 'success', data }))
      .catch(() => !ignore && setWiki({ status: 'error', data: null }))
    return () => {
      ignore = true
    }
  }, [openNameSci])

  const toggle = (rank) => setOpenRank((current) => (current === rank ? null : rank))
  const [genus, epithet] = speciesNameSci.split(' ')

  return (
    <div className={styles.wrap}>
      <dl className={styles.table}>
        {items
          .filter((item) => item.inTable)
          .map(({ rank, label, taxon }) => {
            const count = TAXON_RANKS[rank] ? filterByTaxon(speciesList, rank, taxon.nameSci).length : 0
            const nameZh = cleanZh(taxon.nameZh)
            return (
              <div key={rank} className={styles.row}>
                <dt>{label}</dt>
                <dd>
                  <span className={styles.name}>
                    <span className={styles.nameText}>
                      {nameZh ?? ''} <span className="scientific-name">{taxon.nameSci}</span>
                    </span>
                    <button
                      type="button"
                      className={styles.help}
                      aria-expanded={openRank === rank}
                      aria-controls="taxonomy-explain"
                      aria-label={`什麼是${nameZh ?? taxon.nameSci}？`}
                      onClick={() => toggle(rank)}
                    >
                      ?
                    </button>
                  </span>
                  {/* 同一個分類還有其他物種才顯示；中文名一起帶過去（屬的中文名資料裡沒有） */}
                  {count > 1 && (
                    <Link
                      to={taxonPath(rank, taxon.nameSci)}
                      state={{ nameZh }}
                      className={styles.more}
                      aria-label={`看看其他的${nameZh ?? taxon.nameSci}動物（${count} 種）`}
                    >
                      {label} {count} 種
                    </Link>
                  )}
                </dd>
              </div>
            )
          })}
      </dl>

      {openItem && (
        <section id="taxonomy-explain" className={styles.explain} aria-live="polite">
          <div className={styles.explainHeader}>
            <h3 className={styles.explainTitle}>
              {openItem.taxon.nameZh ?? ''}{' '}
              <span className="scientific-name">{openItem.taxon.nameSci}</span> 是什麼？
            </h3>
            <button type="button" className={styles.close} aria-label="關閉說明" onClick={() => setOpenRank(null)}>
              ×
            </button>
          </div>

          {/* 分類小教室：界 › 門 › 綱 › 目 › 科 › 屬 › 種，點任何一階都能切換說明 */}
          <p className={styles.lessonLabel}>📚 分類小教室</p>
          <ol className={styles.ladder} aria-label="分類階層，點選可查看說明">
            {items.map(({ rank, label, taxon }) => (
              <li key={rank}>
                <button
                  type="button"
                  className={styles.step}
                  aria-pressed={rank === openRank}
                  title={`${label}：${taxon.nameZh ?? taxon.nameSci}`}
                  onClick={() => setOpenRank(rank)}
                >
                  {label}
                </button>
              </li>
            ))}
          </ol>
          <p className={styles.intro}>
            {openItem.intro}
            {openItem.rank === 'genus' && (
              <>
                這種動物的學名 <span className="scientific-name">{speciesNameSci}</span> 中，
                <span className="scientific-name">{genus}</span> 就是屬名。
              </>
            )}
            {openItem.rank === 'species' && epithet && (
              <>
                這種動物的學名 <span className="scientific-name">{speciesNameSci}</span> 中，
                <span className="scientific-name">{genus}</span> 是屬名，
                <span className="scientific-name">{epithet}</span> 是種小名。
              </>
            )}
          </p>

          {/* 這個分類的維基百科介紹 */}
          <div className={styles.wiki}>
            {wiki.status === 'loading' && <p className={styles.muted}>正在查詢維基百科…</p>}
            {wiki.status === 'error' && <p className={styles.muted}>暫時無法取得介紹，請稍後再試</p>}
            {wiki.status === 'success' && !wiki.data && (
              <p className={styles.muted}>
                維基百科目前沒有這個分類的中文介紹，可以到{' '}
                <a href={`https://www.inaturalist.org/taxa/${openItem.taxon.id}`} target="_blank" rel="noreferrer">
                  iNaturalist
                </a>{' '}
                查看
              </p>
            )}
            {wiki.status === 'success' && wiki.data && (
              <>
                <p>{wiki.data.extract}</p>
                <p className={styles.source}>
                  摘自維基百科（CC BY-SA 授權）
                  {wiki.data.url && (
                    <>
                      ・
                      <a href={wiki.data.url} target="_blank" rel="noreferrer">
                        閱讀全文 →
                      </a>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
