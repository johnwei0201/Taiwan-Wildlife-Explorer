import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PhotoGallery from '../../components/PhotoGallery/PhotoGallery.jsx'
import MonthChart from '../../components/MonthChart/MonthChart.jsx'
import SpeciesMap from '../../components/SpeciesMap/SpeciesMap.jsx'
import LocationIcon from '../../components/LocationIcon/LocationIcon.jsx'
import TaxonomyTable from '../../components/TaxonomyTable/TaxonomyTable.jsx'
import { fetchTaxon, fetchMonthlyCounts, fetchRecentObservations, fetchSpeciesNearby } from '../../api/inaturalist.js'
import { formatKm } from '../../utils/geo.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import { useGeolocation } from '../../hooks/useGeolocation.js'
import InfoTag from '../../components/InfoTag/InfoTag.jsx'
import {
  ALIEN_INFO,
  ALIEN_LABELS,
  ENDEMIC_INFO,
  PROTECTED_INFO,
  REDLIST_INFO,
  REDLIST_LABELS,
  TAXONOMY_RANKS,
} from '../../constants/labels.js'
import styles from './SpeciesDetailPage.module.css'

const RADIUS_OPTIONS = [1, 5, 10] // 公里

export default function SpeciesDetailPage() {
  const { id } = useParams()

  // 三個即時區塊各自載入：其中一個失敗，不影響其他區塊
  const taxon = useAsync((signal) => fetchTaxon(id, signal), [id])
  const monthly = useAsync((signal) => fetchMonthlyCounts(id, signal), [id])
  const recent = useAsync((signal) => fetchRecentObservations(id, signal), [id])

  // 若物種在我們整理好的清單中，補上 TaiCOL 的資料（官方中文名、保育等級等）
  const { speciesList } = useSpeciesList()
  const local = speciesList.find((species) => species.id === Number(id))

  // 我的位置：定位後查詢這個物種在使用者附近的紀錄（半徑可切換）
  const { location: userLocation, isLocating, error: geoError, locate } = useGeolocation()
  const [radius, setRadius] = useState(5)
  const nearby = useAsync(
    (signal) => (userLocation ? fetchSpeciesNearby(id, userLocation, radius, signal) : Promise.resolve(null)),
    [id, userLocation, radius],
  )

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
          {/* 我的位置：看看這種動物離自己多遠、附近有沒有出現過 */}
          <button type="button" className={styles.locate} onClick={locate} disabled={isLocating}>
            <LocationIcon />
            {isLocating ? '定位中…' : '我的位置'}
          </button>
        </div>
        <p className={styles.sectionNote}>
          色塊為所有紀錄的分布熱點，橘點為觀察紀錄。為保護野生動物，敏感物種的位置已模糊化。
          {userLocation && ' 藍點是你的約略位置，不會被儲存。'}
        </p>
        {geoError && (
          <p className={styles.geoError}>
            {geoError === 'unsupported' ? '你的瀏覽器不支援定位' : '無法取得你的位置（可能未允許定位）'}
          </p>
        )}

        {userLocation && (
          <div className={styles.nearbyBar}>
            <div className={styles.radius} role="group" aria-label="搜尋半徑">
              {RADIUS_OPTIONS.map((km) => (
                <button
                  key={km}
                  type="button"
                  aria-pressed={radius === km}
                  className={styles.radiusButton}
                  onClick={() => setRadius(km)}
                >
                  {km} 公里
                </button>
              ))}
            </div>
            <NearbySummary nearby={nearby} name={displayName} />
          </div>
        )}

        <div className={styles.mapLayout}>
          <SpeciesMap
            taxonId={id}
            observations={(userLocation ? nearby.data?.observations : recent.data) ?? []}
            userLocation={userLocation}
            radius={radius}
            nearest={nearby.data?.total === 0 ? nearby.data.observations[0] : null}
          />
          <div>
            {userLocation ? (
              <>
                <h3 className={styles.listTitle}>離你最近的紀錄</h3>
                <RecordList
                  status={nearby.status}
                  records={nearby.data?.observations ?? []}
                  emptyText={`你附近 ${nearby.data?.searchedRadius ?? radius} 公里內都沒有紀錄`}
                />
              </>
            ) : (
              <>
                <h3 className={styles.listTitle}>最新紀錄</h3>
                <RecordList status={recent.status} records={recent.data ?? []} emptyText="台灣目前還沒有觀察紀錄" />
              </>
            )}
          </div>
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

        {/* 標籤：滑鼠移上去（手機點一下）會出現說明 */}
        <ul className={styles.tags}>
          {endemic && (
            <li>
              <InfoTag label="臺灣特有種" title={ENDEMIC_INFO.title} className={`${styles.tag} ${styles.endemic}`}>
                <p>{ENDEMIC_INFO.text}</p>
              </InfoTag>
            </li>
          )}
          {local?.protectedLevel && (
            <li>
              <InfoTag
                label={`${local.protectedLevel} 級保育類`}
                title={PROTECTED_INFO.title}
                className={`${styles.tag} ${styles.protected}`}
              >
                <p>{PROTECTED_INFO.text}</p>
                <ul className={styles.infoList}>
                  {Object.entries(PROTECTED_INFO.levels).map(([level, text]) => (
                    <li key={level} data-current={level === local.protectedLevel}>
                      {text}
                    </li>
                  ))}
                </ul>
              </InfoTag>
            </li>
          )}
          {alienLabel && (
            <li>
              <InfoTag
                label={alienLabel}
                title={ALIEN_INFO[local.alienType].title}
                className={`${styles.tag} ${styles.alien}`}
              >
                <p>{ALIEN_INFO[local.alienType].text}</p>
              </InfoTag>
            </li>
          )}
          {redlistLabel && (
            <li>
              <InfoTag
                label={`紅皮書：${redlistLabel}`}
                title={REDLIST_INFO.title}
                className={`${styles.tag} ${styles.redlist}`}
              >
                <RedlistExplain code={local.redlist} />
              </InfoTag>
            </li>
          )}
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

// ---------- 紅皮書說明：危機等級階梯圖，目前等級標成金色 ----------
function RedlistExplain({ code }) {
  const current = REDLIST_INFO.scale.find((item) => item.code === code)

  return (
    <>
      <p>{REDLIST_INFO.text}</p>
      <ol className={styles.redlistScale}>
        {REDLIST_INFO.scale.map((item) => (
          <li key={item.code}>
            {/* 文字包在 span 裡：金色底只套在文字上，前面的 › 不會被包進去 */}
            <span data-current={item.code === code}>{item.label}</span>
          </li>
        ))}
      </ol>
      <p>
        <strong>{current ? `${current.label}：${current.text}` : REDLIST_INFO.others[code]}</strong>
      </p>
    </>
  )
}

// ---------- 定位後的結果摘要：附近有幾筆、最近的在多遠 ----------
function NearbySummary({ nearby, name }) {
  if (nearby.status === 'loading') return <p className={styles.nearbySummary}>正在搜尋你附近的紀錄…</p>
  if (nearby.status === 'error' || !nearby.data) {
    return <p className={styles.nearbySummary}>暫時無法取得附近的紀錄，請稍後再試</p>
  }

  const { radius, total, observations, searchedRadius } = nearby.data
  const nearest = observations[0]
  const where = nearest && `（${nearest.observedOn ?? '日期不明'}，${nearest.placeGuess ?? '地點不明'}）`

  if (total > 0) {
    return (
      <p className={styles.nearbySummary}>
        你附近 {radius} 公里內有 <strong>{total}</strong> 筆{name}的紀錄，最近一筆約{' '}
        <strong>{formatKm(nearest.distanceKm)}</strong> 公里{where}
      </p>
    )
  }
  if (nearest) {
    return (
      <p className={styles.nearbySummary}>
        你附近 {radius} 公里內沒有紀錄。最近的紀錄約在 <strong>{formatKm(nearest.distanceKm)}</strong> 公里外{where}
      </p>
    )
  }
  return (
    <p className={styles.nearbySummary}>
      你附近 <strong>{searchedRadius}</strong> 公里內都沒有{name}的紀錄，可以看看上方的分布熱點
    </p>
  )
}

// ---------- 觀察紀錄列表（最新紀錄／離你最近的紀錄共用） ----------
function RecordList({ status, records, emptyText }) {
  if (status === 'loading') return <div className={`skeleton ${styles.skeletonBlock}`} />
  if (status === 'error') return <p className={styles.message}>暫時無法取得紀錄</p>
  if (records.length === 0) return <p className={styles.message}>{emptyText}</p>

  return (
    <ul className={styles.records}>
      {records.map((obs) => (
        <li key={obs.id}>
          <a href={obs.url} target="_blank" rel="noreferrer" className={styles.record}>
            <span className={styles.recordDate}>{obs.observedOn ?? '日期不明'}</span>
            {obs.distanceKm != null && (
              <span className={styles.recordDistance}>距離約 {formatKm(obs.distanceKm)} 公里</span>
            )}
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
