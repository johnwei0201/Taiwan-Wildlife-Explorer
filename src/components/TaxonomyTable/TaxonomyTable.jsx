import { useEffect, useState } from 'react'
import { fetchWikiSummary } from '../../api/wikipedia.js'
import { RANK_LADDER } from '../../constants/labels.js'
import styles from './TaxonomyTable.module.css'

/**
 * 分類階層表（綱、目、科、屬），每一層後面有「？」按鈕
 * 點「？」會在表格下方展開說明：
 *   1. 分類小教室：這一層（例如「科」）是什麼意思
 *   2. 這個分類（例如「鷺科」）的維基百科介紹
 *
 * items：[{ rank, label, intro, ancestor: { id, nameSci, nameZh } }]
 */
export default function TaxonomyTable({ items, speciesNameSci }) {
  const [openRank, setOpenRank] = useState(null)
  const [wiki, setWiki] = useState({ status: 'idle', data: null })

  const openItem = items.find((item) => item.rank === openRank)
  const openNameSci = openItem?.ancestor.nameSci

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

  return (
    <div className={styles.wrap}>
      <dl className={styles.table}>
        {items.map(({ rank, label, ancestor }) => (
          <div key={rank} className={styles.row}>
            <dt>{label}</dt>
            <dd>
              {ancestor.nameZh ?? ''} <span className="scientific-name">{ancestor.nameSci}</span>
              <button
                type="button"
                className={styles.help}
                aria-expanded={openRank === rank}
                aria-controls="taxonomy-explain"
                aria-label={`什麼是${ancestor.nameZh ?? ancestor.nameSci}？`}
                onClick={() => toggle(rank)}
              >
                ?
              </button>
            </dd>
          </div>
        ))}
      </dl>

      {openItem && (
        <section id="taxonomy-explain" className={styles.explain} aria-live="polite">
          <div className={styles.explainHeader}>
            <h3 className={styles.explainTitle}>
              {openItem.ancestor.nameZh ?? ''}{' '}
              <span className="scientific-name">{openItem.ancestor.nameSci}</span> 是什麼？
            </h3>
            <button type="button" className={styles.close} aria-label="關閉說明" onClick={() => setOpenRank(null)}>
              ×
            </button>
          </div>

          {/* 分類小教室：界 › 門 › 綱 › 目 › 科 › 屬 › 種，目前這一層標成金色 */}
          <p className={styles.lessonLabel}>📚 分類小教室</p>
          <ol className={styles.ladder}>
            {RANK_LADDER.map(({ rank, label }) => (
              <li key={rank} data-current={rank === openItem.rank}>
                {label}
              </li>
            ))}
          </ol>
          <p className={styles.intro}>
            {openItem.intro}
            {openItem.rank === 'genus' && (
              <>
                這種動物的學名 <span className="scientific-name">{speciesNameSci}</span> 中，
                <span className="scientific-name">{openItem.ancestor.nameSci}</span> 就是屬名。
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
                <a href={`https://www.inaturalist.org/taxa/${openItem.ancestor.id}`} target="_blank" rel="noreferrer">
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
