import { useState } from 'react'
import styles from './PhotoGallery.module.css'

// 照片集：一張大圖＋縮圖列，點縮圖切換
export default function PhotoGallery({ photos, alt }) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (photos.length === 0) {
    return (
      <div className={styles.main}>
        <div className={styles.placeholder} aria-hidden="true">🐾</div>
      </div>
    )
  }

  const active = photos[activeIndex]

  return (
    <div>
      <div className={styles.main}>
        <img src={active.largeUrl ?? active.url} alt={alt} className={styles.mainImage} />
        {/* CC 授權規定：必須標示作者與授權 */}
        <p className={styles.credit}>
          © {active.author}・{active.license}
        </p>
      </div>

      {photos.length > 1 && (
        <ul className={styles.thumbs}>
          {photos.slice(0, 8).map((photo, index) => (
            <li key={photo.url}>
              <button
                type="button"
                className={styles.thumb}
                aria-pressed={index === activeIndex}
                aria-label={`第 ${index + 1} 張照片`}
                onClick={() => setActiveIndex(index)}
              >
                <img src={photo.url} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
