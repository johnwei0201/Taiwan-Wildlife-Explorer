import { useEffect, useState } from 'react'
import styles from './BreedList.module.css'

const PAGE_SIZE = 12

// 品種介紹（家貓、家犬詳細頁）：資料來自 scripts/fetch-breeds.js 產生的 breeds.json
//   依知名度（有幾種語言的維基百科條目）排序，先看到大家比較熟悉的品種
export default function BreedList({ kind }) {
  const [breeds, setBreeds] = useState([])
  const [status, setStatus] = useState('loading')
  const [shownCount, setShownCount] = useState(PAGE_SIZE)

  useEffect(() => {
    fetch('/data/breeds.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setBreeds(data.filter((b) => b.kind === kind).sort((a, b) => b.popularity - a.popularity))
        setStatus('success')
      })
      .catch(() => setStatus('error'))
  }, [kind])

  if (status === 'loading') return <div className={`skeleton ${styles.skeleton}`} />
  if (status === 'error') return <p className={styles.message}>暫時無法取得品種資料</p>

  return (
    <div>
      <ul className={styles.grid}>
        {breeds.slice(0, shownCount).map((breed) => (
          <li key={breed.id}>
            <BreedCard breed={breed} />
          </li>
        ))}
      </ul>
      {shownCount < breeds.length && (
        <button type="button" className={styles.more} onClick={() => setShownCount((n) => n + PAGE_SIZE)}>
          顯示更多（還有 {breeds.length - shownCount} 種）
        </button>
      )}
      <p className={styles.source}>
        資料來源：Wikidata、中文維基百科（CC BY-SA）、Wikimedia Commons（照片授權標示於各張照片）
      </p>
    </div>
  )
}

function BreedCard({ breed }) {
  const [photoStatus, setPhotoStatus] = useState('loading')

  return (
    // 點卡片到維基百科看完整介紹（另開分頁）
    <a href={breed.wikipediaUrl} target="_blank" rel="noreferrer" className={styles.card}>
      <div className={`${styles.imageWrap} ${photoStatus === 'loading' ? 'skeleton' : ''}`}>
        {photoStatus !== 'error' ? (
          <>
            <img
              src={breed.photo.url}
              alt={breed.nameZh}
              loading="lazy"
              className={styles.image}
              data-loaded={photoStatus === 'loaded'}
              onLoad={() => setPhotoStatus('loaded')}
              onError={() => setPhotoStatus('error')}
            />
            {/* CC 授權規定：必須標示作者與授權 */}
            {photoStatus === 'loaded' && (
              <p className={styles.credit}>
                © {breed.photo.author}・{breed.photo.license}
              </p>
            )}
          </>
        ) : (
          <div className={styles.placeholder} aria-hidden="true">🐾</div>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>{breed.nameZh}</h3>
        {breed.nameEn && <p className={styles.nameEn}>{breed.nameEn}</p>}
        {breed.origins.length > 0 && <p className={styles.origin}>原產地：{breed.origins.join('、')}</p>}
        {breed.summary && <p className={styles.summary}>{breed.summary}</p>}
        <span className={styles.wiki}>維基百科 ↗</span>
      </div>
    </a>
  )
}
