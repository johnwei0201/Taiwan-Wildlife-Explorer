import { Link } from 'react-router-dom'
import { TAXON_RANKS, taxonPath } from '../../utils/taxon.js'
import styles from './TaxonPath.module.css'

/**
 * 分類路徑：綱 → 目 → 科 → 屬，一層接一層的箭頭標籤，上方是網站收錄的種數
 *   分類頁、物種詳細頁共用；點標籤會到該層的分類頁
 *
 * steps：由大到小 [{ rank, nameSci, nameZh, count }]
 * currentRank：目前所在的那一層（分類頁才有），顯示成「你在這裡」、不是連結
 */
export default function TaxonPath({ steps, currentRank = null, className = '' }) {
  if (steps.length === 0) return null

  return (
    <nav aria-label="分類路徑" className={className}>
      <ol className={styles.path}>
        {steps.map((step) => {
          const isCurrent = step.rank === currentRank
          const name = step.nameZh ?? step.nameSci
          const content = (
            <>
              <span className={styles.count}>{step.count} 種</span>
              <span className={styles.name}>{name}</span>
            </>
          )
          return (
            <li key={step.rank}>
              {/* 目前這一層、或網站沒收錄任何物種的層級，不做成連結 */}
              {isCurrent || step.count === 0 ? (
                <span
                  className={styles.step}
                  data-rank={step.rank}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {content}
                </span>
              ) : (
                <Link
                  to={taxonPath(step.rank, step.nameSci)}
                  state={{ nameZh: step.nameZh }}
                  className={styles.step}
                  data-rank={step.rank}
                  aria-label={`${name}（${TAXON_RANKS[step.rank].label}，${step.count} 種）`}
                >
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
