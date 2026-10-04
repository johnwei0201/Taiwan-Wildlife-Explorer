import { Link } from 'react-router-dom'
import styles from './SpeciesCard.module.css'

// 物種卡片：列表頁和「我附近的動物」都會共用這個元件
export default function SpeciesCard({ species }) {
  const { id, nameZh, nameSci, photoUrl, endemic, protected: isProtected } = species

  return (
    <Link to={`/species/${id}`} className={styles.card}>
      <div className={styles.imageWrap}>
        {photoUrl ? (
          <img src={photoUrl} alt={nameZh} loading="lazy" className={styles.image} />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">🐾</div>
        )}
      </div>

      <div className={styles.body}>
        <h3 className={styles.nameZh}>{nameZh}</h3>
        <p className={`scientific-name ${styles.nameSci}`}>{nameSci}</p>

        {(endemic || isProtected) && (
          <ul className={styles.tags}>
            {endemic && <li className={`${styles.tag} ${styles.endemic}`}>特有</li>}
            {isProtected && <li className={`${styles.tag} ${styles.protected}`}>保育類</li>}
          </ul>
        )}
      </div>
    </Link>
  )
}
