import { Link } from 'react-router-dom'
import { ALIEN_LABELS } from '../../constants/labels.js'
import styles from './SpeciesCard.module.css'

// 物種卡片：列表頁和「我附近的動物」都會共用這個元件
export default function SpeciesCard({ species }) {
  const { id, nameZh, nameSci, photo, endemic, protectedLevel, alienType } = species
  const alienLabel = ALIEN_LABELS[alienType]

  return (
    <Link to={`/species/${id}`} className={styles.card}>
      <div className={styles.imageWrap}>
        {photo ? (
          <>
            <img src={photo.url} alt={nameZh ?? nameSci} loading="lazy" className={styles.image} />
            {/* CC 授權規定：必須標示作者與授權 */}
            <p className={styles.credit}>
              © {photo.author}・{photo.license}
            </p>
          </>
        ) : (
          <div className={styles.placeholder} aria-hidden="true">🐾</div>
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.nameZh}>{nameZh ?? nameSci}</h3>
        <p className={`scientific-name ${styles.nameSci}`}>{nameSci}</p>

        {(endemic || protectedLevel || alienLabel) && (
          <ul className={styles.tags}>
            {endemic && <li className={`${styles.tag} ${styles.endemic}`}>特有</li>}
            {protectedLevel && (
              <li className={`${styles.tag} ${styles.protected}`}>{protectedLevel} 級保育</li>
            )}
            {/* 外來種分兩層顯示：外來種 › 入侵種／歸化種／栽培豢養 */}
            {alienLabel && (
              <li className={`${styles.tag} ${alienType === 'invasive' ? styles.invasive : styles.alien}`}>
                外來種<span className={styles.tagArrow} aria-hidden="true">›</span>
                {alienLabel}
              </li>
            )}
          </ul>
        )}
      </div>
    </Link>
  )
}
