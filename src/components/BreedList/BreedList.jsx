import { useEffect, useState } from 'react'
import FilterPanel from '../FilterPanel/FilterPanel.jsx'
import { BREED_FILTERS, applyFilters } from '../../constants/filters.js'
import styles from './BreedList.module.css'

const PAGE_SIZE = 12
const EMPTY_FILTERS = { size: '', coat: '', color: '' }

// 品種介紹（家貓、家犬詳細頁）：資料來自 scripts/fetch-breeds.js 產生的 breeds.json
//   依知名度（有幾種語言的維基百科條目）排序，先看到大家比較熟悉的品種
//   上方的「用外觀找找看」可以依體型、毛、顏色篩選，找出路上看到的貓狗可能是什麼品種
export default function BreedList({ kind }) {
  const [breeds, setBreeds] = useState([])
  const [status, setStatus] = useState('loading')
  const [shownCount, setShownCount] = useState(PAGE_SIZE)
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  // 改篩選條件時，清單回到只顯示第一批
  const changeFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setShownCount(PAGE_SIZE)
  }
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setShownCount(PAGE_SIZE)
  }

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

  const filtered = applyFilters(breeds, filters, null, BREED_FILTERS)

  return (
    <div>
      <FilterPanel
        list={breeds}
        group={kind}
        filters={filters}
        onChange={changeFilter}
        onClear={clearFilters}
        defs={BREED_FILTERS}
        note="體型、毛與顏色為 AI 協助標記，僅供參考；混種的外觀差異很大，結果只能當作參考"
      />

      <p className={styles.count}>
        共 {filtered.length} 種
        {filtered.length < breeds.length && `（從 ${breeds.length} 種中篩選）`}
      </p>

      {filtered.length === 0 ? (
        <p className={styles.message}>沒有符合條件的品種，試著減少一些條件</p>
      ) : (
        <ul className={styles.grid}>
          {filtered.slice(0, shownCount).map((breed) => (
            <li key={breed.id}>
              <BreedCard breed={breed} />
            </li>
          ))}
        </ul>
      )}
      {shownCount < filtered.length && (
        <button type="button" className={styles.more} onClick={() => setShownCount((n) => n + PAGE_SIZE)}>
          顯示更多（還有 {filtered.length - shownCount} 種）
        </button>
      )}
      <p className={styles.source}>
        資料來源：Wikidata、中文維基百科（CC BY-SA）、Wikimedia Commons（照片授權標示於各張照片）
      </p>
    </div>
  )
}

// 卡片上的體型簡稱（篩選選單用的是附體重的完整說明）
const SIZE_SHORT = {
  dog: ['迷你', '小型', '中型', '大型', '超大型'],
  cat: ['小型', '中型', '大型'],
}

function BreedCard({ breed }) {
  const features = [SIZE_SHORT[breed.kind]?.[breed.size - 1], breed.coat].filter(Boolean).join('・')

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
        {features && <p className={styles.features}>{features}</p>}
        {breed.origins.length > 0 && <p className={styles.origin}>原產地：{breed.origins.join('、')}</p>}
        {breed.summary && <p className={styles.summary}>{breed.summary}</p>}
        <span className={styles.wiki}>維基百科 ↗</span>
      </div>
    </a>
  )
}
