import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ALIEN_LABELS } from '../../constants/labels.js'
import styles from './SpeciesCard.module.css'

// 物種卡片：列表頁和「我附近的動物」都會共用這個元件
export default function SpeciesCard({ species }) {
  const { id, nameZh, nameSci, photo, endemic, protectedLevel, alienType } = species
  const alienLabel = ALIEN_LABELS[alienType]

  // 照片放在 iNaturalist 的伺服器上，有時要好幾秒才載入完成，甚至失敗：
  //   loading 下載中 → 閃爍動畫，讓人知道「正在載入」而不是壞掉
  //   loaded  完成   → 照片淡入
  //   error   失敗   → 改顯示 🐾，和沒有照片的物種一樣
  const [photoStatus, setPhotoStatus] = useState('loading')
  const imgRef = useRef(null)

  // 照片已經在瀏覽器快取裡時，可能在 React 綁定 onLoad 之前就載完了，這裡補檢查一次
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete) setPhotoStatus(img.naturalWidth > 0 ? 'loaded' : 'error')
  }, [])

  const showPhoto = photo && photoStatus !== 'error'

  return (
    <Link to={`/species/${id}`} className={styles.card}>
      <div className={`${styles.imageWrap} ${showPhoto && photoStatus === 'loading' ? 'skeleton' : ''}`}>
        {showPhoto ? (
          <>
            <img
              ref={imgRef}
              src={photo.url}
              alt={nameZh ?? nameSci}
              loading="lazy"
              className={styles.image}
              data-loaded={photoStatus === 'loaded'}
              onLoad={() => setPhotoStatus('loaded')}
              onError={() => setPhotoStatus('error')}
            />
            {/* CC 授權規定：必須標示作者與授權 */}
            {photoStatus === 'loaded' && (
              <p className={styles.credit}>
                © {photo.author}・{photo.license}
              </p>
            )}
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
