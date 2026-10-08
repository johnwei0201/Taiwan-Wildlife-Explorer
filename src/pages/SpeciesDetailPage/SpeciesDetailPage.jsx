import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PhotoGallery from '../../components/PhotoGallery/PhotoGallery.jsx'
import MonthChart from '../../components/MonthChart/MonthChart.jsx'
import SpeciesMap from '../../components/SpeciesMap/SpeciesMap.jsx'
import SpeciesCard from '../../components/SpeciesCard/SpeciesCard.jsx'
import LocationIcon from '../../components/LocationIcon/LocationIcon.jsx'
import TaxonomyTable from '../../components/TaxonomyTable/TaxonomyTable.jsx'
import TaxonPath from '../../components/TaxonPath/TaxonPath.jsx'
import { RANK_ORDER, cleanZh, filterByTaxon } from '../../utils/taxon.js'
import InfoTag from '../../components/InfoTag/InfoTag.jsx'
import {
  fetchTaxon,
  fetchMonthlyCounts,
  fetchRecentObservations,
  fetchSpeciesNearby,
  fetchNearbySpecies,
  fetchLarvaPhotos,
} from '../../api/inaturalist.js'
import { fetchWikiSummary, toTraditional } from '../../api/wikipedia.js'
import { formatKm } from '../../utils/geo.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useSpeciesList, withLocalData } from '../../hooks/useSpeciesList.js'
import { useGeolocation } from '../../hooks/useGeolocation.js'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import {
  ALIEN_GENERAL,
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
  const { location: userLocation, isLocating, error: geoError, locate, clearLocation } = useGeolocation()
  const [radius, setRadius] = useState(5)
  const nearby = useAsync(
    (signal) => (userLocation ? fetchSpeciesNearby(id, userLocation, radius, signal) : Promise.resolve(null)),
    [id, userLocation, radius],
  )
  // 同一個範圍內還出現過哪些動物（右側清單，和「我附近的動物」頁面相同）
  const nearbyAnimals = useAsync(
    (signal) => (userLocation ? fetchNearbySpecies({ ...userLocation, radius }, signal) : Promise.resolve(null)),
    [userLocation, radius],
  )

  // 蝴蝶、蛾（鱗翅目）才查幼蟲照片：小時候是毛毛蟲，長大後完全不一樣
  const isLepidoptera = Boolean(taxon.data?.ancestors.some((a) => a.nameSci === 'Lepidoptera'))
  const larva = useAsync(
    (signal) => (isLepidoptera ? fetchLarvaPhotos(id, signal) : Promise.resolve(null)),
    [id, isLepidoptera],
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
        <SpeciesHero taxon={taxon.data} local={local} displayName={displayName} speciesList={speciesList} />
      )}

      {isLepidoptera && <LarvaPhotos larva={larva} name={displayName} />}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>月份出現分布</h2>
        <p className={styles.sectionNote}>台灣每個月的研究級觀察紀錄數</p>
        {monthly.status === 'loading' && <div className={`skeleton ${styles.skeletonBlock}`} />}
        {monthly.status === 'error' && <p className={styles.message}>暫時無法取得月份資料</p>}
        {monthly.status === 'success' && <MonthChart counts={monthly.data} />}
      </section>

      <section className={styles.section}>
        {/* 兩種檢視模式：台灣出沒地圖（全台）／我的位置（附近），按下的那個就是目前模式 */}
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <button
              type="button"
              className={styles.titleButton}
              aria-pressed={!userLocation}
              title="回到台灣全圖"
              onClick={clearLocation}
            >
              台灣出沒地圖
            </button>
          </h2>
          {/* 我的位置：看看這種動物離自己多遠、附近有沒有出現過 */}
          <button
            type="button"
            className={styles.locate}
            aria-pressed={Boolean(userLocation)}
            onClick={locate}
            disabled={isLocating}
          >
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
                <h3 className={styles.listTitle}>你附近 {radius} 公里內的動物</h3>
                <NearbyAnimals result={nearbyAnimals} speciesList={speciesList} currentId={Number(id)} />
              </>
            ) : (
              <RecentRecords status={recent.status} records={recent.data ?? []} />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

// ---------- 上半部：照片與基本資料 ----------
function SpeciesHero({ taxon, local, displayName, speciesList }) {
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

  // 分類路徑（綱 → 目 → 科 → 屬）：每一層附上網站收錄的種數，點了到該層的分類頁
  const pathSteps = RANK_ORDER.map((rank) => taxonomy.find((item) => item.rank === rank))
    .filter(Boolean)
    .map(({ rank, taxon: t }) => ({
      rank,
      nameSci: t.nameSci,
      nameZh: cleanZh(t.nameZh),
      count: filterByTaxon(speciesList, rank, t.nameSci).length,
    }))

  return (
    <section className={styles.hero}>
      <PhotoGallery photos={taxon.photos} alt={displayName} />

      <div>
        <h1 className={styles.nameZh}>{displayName}</h1>
        <p className={`scientific-name ${styles.nameSci}`}>{taxon.nameSci}</p>
        {taxon.nameEn && <p className={styles.nameEn}>{taxon.nameEn}</p>}

        <TaxonPath steps={pathSteps} className={styles.taxonPath} />

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
              {/* 外來種分兩層：外來種 › 入侵種／歸化種／栽培豢養；彈窗先說明外來種，再說明細項 */}
              <InfoTag
                label={`外來種 › ${alienLabel}`}
                title={ALIEN_INFO[local.alienType].title}
                className={`${styles.tag} ${local.alienType === 'invasive' ? styles.invasive : styles.alien}`}
              >
                <p className={styles.infoLead}>{ALIEN_GENERAL}</p>
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
          <TaxonomyTable key={taxon.id} items={taxonomy} speciesNameSci={taxon.nameSci} speciesList={speciesList} />
        )}

        <SpeciesSummary taxon={taxon} nameZh={displayName} />
      </div>
    </section>
  )
}

// ---------- 物種簡介：維基百科正體中文 ----------
// 1. 用學名查中文維基（指定 zh-tw，自動轉成正體）
// 2. 查不到時改用中文名再查一次
// 3. 都查不到，才用 iNaturalist 附的維基摘要，並先轉成正體中文（原文可能是簡體字）
function SpeciesSummary({ taxon, nameZh }) {
  const summary = useAsync(async () => {
    const wiki = (await fetchWikiSummary(taxon.nameSci)) ?? (nameZh ? await fetchWikiSummary(nameZh) : null)
    if (wiki) return { ...wiki, source: 'wikipedia' }
    if (taxon.summary) return { extract: await toTraditional(taxon.summary), source: 'inaturalist' }
    return null
  }, [taxon.nameSci, nameZh, taxon.summary])

  if (summary.status === 'loading') return <div className={`skeleton ${styles.skeletonLine}`} />

  if (summary.status === 'success' && summary.data?.source === 'wikipedia') {
    return (
      <>
        <p className={styles.summary}>{summary.data.extract}</p>
        <p className={styles.source}>
          簡介摘自維基百科（CC BY-SA 授權）
          {summary.data.url && (
            <>
              ・
              <a href={summary.data.url} target="_blank" rel="noreferrer">
                閱讀全文 →
              </a>
            </>
          )}
        </p>
      </>
    )
  }

  // 備案：使用 iNaturalist 附的摘要（已轉正體；維基百科暫時連不上時直接顯示原文）
  const text = summary.data?.extract ?? taxon.summary
  if (!text) return null
  return (
    <>
      <p className={styles.summary}>{text}</p>
      <p className={styles.source}>
        簡介摘自維基百科（CC BY-SA 授權），經由{' '}
        <a href={`https://www.inaturalist.org/taxa/${taxon.id}`} target="_blank" rel="noreferrer">
          iNaturalist
        </a>{' '}
        取得
      </p>
    </>
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

// ---------- 你附近的動物：和「我附近的動物」頁面相同的卡片清單 ----------
function NearbyAnimals({ result, speciesList, currentId }) {
  if (result.status === 'loading') return <div className={`skeleton ${styles.skeletonBlock}`} />
  if (result.status === 'error' || !result.data) return <p className={styles.message}>暫時無法取得附近的動物</p>
  if (result.data.total === 0) return <p className={styles.message}>這附近還沒有紀錄，試試擴大搜尋範圍</p>

  const species = withLocalData(result.data.species, speciesList)

  return (
    <>
      <p className={styles.nearbyCount}>
        共發現 <strong>{result.data.total}</strong> 種
        {result.data.total > species.length && `（顯示最常見的 ${species.length} 種）`}
      </p>
      <ul className={styles.nearbyGrid}>
        {species.map((s) => (
          // 目前正在看的物種如果也在附近，用框線標出來
          <li key={s.id} data-current={s.id === currentId}>
            <SpeciesCard species={s} />
          </li>
        ))}
      </ul>
    </>
  )
}

// ---------- 幼蟲長這樣（蝴蝶、蛾的毛毛蟲） ----------
// 照片來自 iNaturalist 上標註「幼蟲」的觀察紀錄，點照片可以到原始紀錄看更多
function LarvaPhotos({ larva, name }) {
  // 剛確認是鱗翅目的那一瞬間，查詢還沒開始，會先拿到上一次的「成功、但沒有資料（null）」；
  // 這時當作載入中，避免讀取 null 的欄位讓整頁當掉
  const data = larva.status === 'success' ? larva.data : null
  const isLoading = larva.status === 'loading' || (larva.status === 'success' && !data)

  return (
    <section className={styles.section} aria-labelledby="larva-title">
      <h2 id="larva-title" className={styles.sectionTitle}>
        毛毛蟲（幼蟲）長這樣
      </h2>
      <p className={styles.sectionNote}>
        蝴蝶和蛾小時候是毛毛蟲，長大後的樣子完全不一樣
        {data?.total > 0 && `（iNaturalist 上有 ${data.total} 筆幼蟲紀錄）`}
      </p>

      {isLoading && <div className={`skeleton ${styles.larvaSkeleton}`} />}
      {larva.status === 'error' && <p className={styles.message}>暫時無法取得幼蟲照片</p>}
      {data?.photos.length === 0 && <p className={styles.message}>目前還沒有人上傳{name}幼蟲的照片</p>}
      {data?.photos.length > 0 && (
        <ul className={styles.larvaGrid}>
          {data.photos.map((photo) => (
            <li key={photo.id}>
              <a href={photo.observationUrl} target="_blank" rel="noreferrer" className={styles.larvaPhoto}>
                <img src={photo.url} alt={`${name}的幼蟲`} loading="lazy" />
                {/* CC 授權規定：必須標示作者與授權 */}
                <span className={styles.larvaCredit}>
                  © {photo.author}・{photo.license}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------- 發現記錄：手機上預設收起，點標題才展開 ----------
// 手機的版面是上下排列，紀錄清單很長，會把下面的內容推得很遠；平板以上排在地圖旁邊，直接展開
function RecentRecords({ status, records }) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [isOpen, setIsOpen] = useState(false)

  const list = <RecordList status={status} records={records} emptyText="台灣目前還沒有觀察紀錄" />

  if (!isMobile) {
    return (
      <>
        <h3 className={styles.listTitle}>發現記錄</h3>
        {list}
      </>
    )
  }

  return (
    <>
      <h3 className={styles.listTitle}>
        <button
          type="button"
          className={styles.collapseButton}
          aria-expanded={isOpen}
          aria-controls="recent-records"
          onClick={() => setIsOpen((open) => !open)}
        >
          發現記錄
          {status === 'success' && records.length > 0 && <span className={styles.collapseCount}>{records.length} 筆</span>}
          <span className={styles.chevron} aria-hidden="true" />
        </button>
      </h3>
      <div id="recent-records" hidden={!isOpen}>
        {list}
      </div>
    </>
  )
}

// ---------- 觀察紀錄列表（發現記錄） ----------
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
