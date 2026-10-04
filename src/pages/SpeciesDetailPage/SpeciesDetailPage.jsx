import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import PhotoGallery from '../../components/PhotoGallery/PhotoGallery.jsx'
import MonthChart from '../../components/MonthChart/MonthChart.jsx'
import SpeciesMap from '../../components/SpeciesMap/SpeciesMap.jsx'
import TaxonomyTable from '../../components/TaxonomyTable/TaxonomyTable.jsx'
import { fetchTaxon, fetchMonthlyCounts, fetchRecentObservations } from '../../api/inaturalist.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import { useGeolocation } from '../../hooks/useGeolocation.js'
import { ALIEN_LABELS, REDLIST_LABELS, TAXONOMY_RANKS } from '../../constants/labels.js'
import styles from './SpeciesDetailPage.module.css'

export default function SpeciesDetailPage() {
  const { id } = useParams()

  // 三個即時區塊各自載入：其中一個失敗，不影響其他區塊
  const taxon = useAsync((signal) => fetchTaxon(id, signal), [id])
  const monthly = useAsync((signal) => fetchMonthlyCounts(id, signal), [id])
  const recent = useAsync((signal) => fetchRecentObservations(id, signal), [id])

  // 若物種在我們整理好的清單中，補上 TaiCOL 的資料（官方中文名、保育等級等）
  const { speciesList } = useSpeciesList()
  const local = speciesList.find((species) => species.id === Number(id))

  const { location: userLocation, isLocating, error: geoError, locate } = useGeolocation()

  // 瀏覽器分頁標題顯示物種名稱
  const displayName = local?.nameZh ?? taxon.data?.nameZh ?? taxon.data?.nameSci
  useEffect(() => {
    if (displayName) document.title = `${displayName}｜發現台灣動物趣`
    return () => {
      document.title = '發現台灣動物趣 Taiwan Wildlife Explorer'
    }
  }, [displayName])

  return (
    <div className="container">
      <Link to="/" className={styles.back}>← 回到圖鑑</Link>

      {taxon.status === 'loading' && <HeroSkeleton />}
      {taxon.status === 'error' && (
        <p className={styles.message}>找不到這個物種，或暫時無法取得資料，請稍後再試</p>
      )}
      {taxon.status === 'success' && (
        <SpeciesHero taxon={taxon.data} local={local} displayName={displayName} />
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>月份出現分布</h2>
        <p className={styles.sectionNote}>台灣每個月的研究級觀察紀錄數</p>
        {monthly.status === 'loading' && <div className={`skeleton ${styles.skeletonBlock}`} />}
        {monthly.status === 'error' && <p className={styles.message}>暫時無法取得月份資料</p>}
        {monthly.status === 'success' && <MonthChart counts={monthly.data} />}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>台灣出沒地圖</h2>
          {/* 我的位置：把地圖移到使用者附近，看看這種動物離自己多近 */}
          <button type="button" className={styles.locate} onClick={locate} disabled={isLocating}>
            📍 {isLocating ? '定位中…' : '我的位置'}
          </button>
        </div>
        <p className={styles.sectionNote}>
          色塊為所有紀錄的分布熱點，橘點為最新的觀察紀錄。為保護野生動物，敏感物種的位置已模糊化。
          {userLocation && ' 藍點是你的約略位置，不會被儲存。'}
        </p>
        {geoError && (
          <p className={styles.geoError}>
            {geoError === 'unsupported' ? '你的瀏覽器不支援定位' : '無法取得你的位置（可能未允許定位）'}
          </p>
        )}
        <div className={styles.mapLayout}>
          <SpeciesMap taxonId={id} observations={recent.data ?? []} userLocation={userLocation} />
          <RecentRecords recent={recent} />
        </div>
      </section>
    </div>
  )
}

// ---------- 上半部：照片與基本資料 ----------
function SpeciesHero({ taxon, local, displayName }) {
  const endemic = local?.endemic ?? taxon.endemic
  const alienLabel = ALIEN_LABELS[local?.alienType]
  const redlistLabel = REDLIST_LABELS[local?.redlist]
  // 從界到種的完整分類：「種」就是這個物種本身，其他層從 ancestors 找
  const taxonomy = TAXONOMY_RANKS.map((rankInfo) => ({
    ...rankInfo,
    taxon:
      rankInfo.rank === 'species'
        ? { id: taxon.id, nameSci: taxon.nameSci, nameZh: displayName }
        : taxon.ancestors.find((a) => a.rank === rankInfo.rank),
  })).filter((item) => item.taxon)

  return (
    <section className={styles.hero}>
      <PhotoGallery photos={taxon.photos} alt={displayName} />

      <div>
        <h1 className={styles.nameZh}>{displayName}</h1>
        <p className={`scientific-name ${styles.nameSci}`}>{taxon.nameSci}</p>
        {taxon.nameEn && <p className={styles.nameEn}>{taxon.nameEn}</p>}

        <ul className={styles.tags}>
          {endemic && <li className={`${styles.tag} ${styles.endemic}`}>臺灣特有種</li>}
          {local?.protectedLevel && (
            <li className={`${styles.tag} ${styles.protected}`}>{local.protectedLevel} 級保育類</li>
          )}
          {alienLabel && <li className={`${styles.tag} ${styles.alien}`}>{alienLabel}</li>}
          {redlistLabel && <li className={`${styles.tag} ${styles.redlist}`}>紅皮書：{redlistLabel}</li>}
        </ul>

        {taxonomy.length > 0 && (
          // key：換到別的物種時重新建立，展開中的說明會自動關閉
          <TaxonomyTable key={taxon.id} items={taxonomy} speciesNameSci={taxon.nameSci} />
        )}

        {taxon.summary && (
          <>
            <p className={styles.summary}>{taxon.summary}</p>
            <p className={styles.source}>
              簡介摘自維基百科（CC BY-SA 授權），經由{' '}
              <a href={`https://www.inaturalist.org/taxa/${taxon.id}`} target="_blank" rel="noreferrer">
                iNaturalist
              </a>{' '}
              取得
            </p>
          </>
        )}
      </div>
    </section>
  )
}

// ---------- 最新觀察紀錄列表 ----------
function RecentRecords({ recent }) {
  if (recent.status === 'loading') return <div className={`skeleton ${styles.skeletonBlock}`} />
  if (recent.status === 'error') return <p className={styles.message}>暫時無法取得最新紀錄</p>
  if (recent.data.length === 0) return <p className={styles.message}>台灣目前還沒有觀察紀錄</p>

  return (
    <ul className={styles.records}>
      {recent.data.map((obs) => (
        <li key={obs.id}>
          <a href={obs.url} target="_blank" rel="noreferrer" className={styles.record}>
            <span className={styles.recordDate}>{obs.observedOn ?? '日期不明'}</span>
            {obs.obscured && <span className={styles.obscuredBadge}>位置已模糊化</span>}
            <p className={styles.recordPlace}>{obs.placeGuess ?? '地點不明'}</p>
          </a>
        </li>
      ))}
    </ul>
  )
}

// ---------- 載入中的骨架畫面 ----------
function HeroSkeleton() {
  return (
    <section className={styles.hero} aria-label="載入中">
      <div className={`skeleton ${styles.skeletonPhoto}`} />
      <div>
        <div className={`skeleton ${styles.skeletonTitle}`} />
        <div className={`skeleton ${styles.skeletonLine}`} />
        <div className={`skeleton ${styles.skeletonLine}`} />
        <div className={`skeleton ${styles.skeletonLine}`} />
      </div>
    </section>
  )
}
