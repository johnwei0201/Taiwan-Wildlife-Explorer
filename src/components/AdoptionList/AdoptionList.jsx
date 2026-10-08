import { useState } from 'react'
import { AREAS, fetchAdoptableAnimals } from '../../api/adoption.js'
import { useAsync } from '../../hooks/useAsync.js'
import styles from './AdoptionList.module.css'

const PAGE_SIZE = 12

// 等你帶回家：收容所正在等待認養的貓狗（家貓、家犬詳細頁）
export default function AdoptionList({ kind }) {
  const [areaId, setAreaId] = useState('')
  const [shownCount, setShownCount] = useState(PAGE_SIZE)
  const result = useAsync((signal) => fetchAdoptableAnimals({ kind, areaId }, signal), [kind, areaId])

  const animals = result.data ?? []
  const kindLabel = kind === 'cat' ? '貓' : '狗'

  const changeArea = (value) => {
    setAreaId(value)
    setShownCount(PAGE_SIZE)
  }

  return (
    <div>
      <label className={styles.areaLabel}>
        縣市
        <select className={styles.areaSelect} value={areaId} onChange={(e) => changeArea(e.target.value)}>
          <option value="">全台</option>
          {AREAS.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>

      {result.status === 'loading' && <div className={`skeleton ${styles.skeleton}`} />}
      {result.status === 'error' && <p className={styles.message}>暫時無法取得認養資料，請稍後再試</p>}
      {result.status === 'success' && animals.length === 0 && (
        <p className={styles.message}>這個縣市目前沒有等待認養的{kindLabel}</p>
      )}

      {result.status === 'success' && animals.length > 0 && (
        <>
          <ul className={styles.grid}>
            {animals.slice(0, shownCount).map((animal) => (
              <li key={animal.id}>
                <AdoptionCard animal={animal} />
              </li>
            ))}
          </ul>
          {shownCount < animals.length && (
            <button type="button" className={styles.more} onClick={() => setShownCount((n) => n + PAGE_SIZE)}>
              顯示更多
            </button>
          )}
        </>
      )}

      <p className={styles.source}>
        資料來源：農業部動物認領養開放資料（每次顯示最新的 60 隻）。想認養請直接聯絡收容所，或到
        <a href="https://www.pet.gov.tw/" target="_blank" rel="noreferrer">
          寵物登記管理資訊網
        </a>
        查詢。
      </p>
    </div>
  )
}

// 收容所的照片是手機拍的原圖（寬度常有 4000px、一張 1～3MB），12 張就超過 10MB
// 改用 wsrv.nl（開源、免費的圖片縮圖服務）縮成 400px 的 WebP，一張只剩約 30KB
const thumbnail = (url) => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&h=400&fit=cover&output=webp`

function AdoptionCard({ animal }) {
  // thumb 縮圖 → 縮圖服務失敗時改用 original 原圖 → 原圖也失敗就顯示 🐾
  const [photoStage, setPhotoStage] = useState('thumb')
  const [loaded, setLoaded] = useState(false)
  // 卡片標題：品種（「混種貓」直接顯示）；說明：性別・體型・年齡・毛色，有的才顯示
  const details = [animal.sex, animal.body, animal.age, animal.colour].filter(Boolean).join('・')
  const showPhoto = animal.photo && photoStage !== 'failed'

  return (
    <article className={styles.card}>
      <div className={`${styles.imageWrap} ${showPhoto && !loaded ? 'skeleton' : ''}`}>
        {showPhoto ? (
          <img
            src={photoStage === 'thumb' ? thumbnail(animal.photo) : animal.photo}
            alt={animal.variety ?? '等待認養的動物'}
            loading="lazy"
            className={styles.image}
            data-loaded={loaded}
            onLoad={() => setLoaded(true)}
            onError={() => setPhotoStage((stage) => (stage === 'thumb' ? 'original' : 'failed'))}
          />
        ) : (
          <div className={styles.placeholder} aria-hidden="true">🐾</div>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>{animal.variety ?? '未註明品種'}</h3>
        {details && <p className={styles.details}>{details}</p>}
        <p className={styles.shelter}>{animal.shelter}</p>
        {animal.phone && (
          <a className={styles.tel} href={animal.phone.href}>
            ☎ {animal.phone.display}
          </a>
        )}
      </div>
    </article>
  )
}
