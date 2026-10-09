import { useEffect, useState } from 'react'
import NearbyMap from '../../components/NearbyMap/NearbyMap.jsx'
import SpeciesCard from '../../components/SpeciesCard/SpeciesCard.jsx'
import LocationIcon from '../../components/LocationIcon/LocationIcon.jsx'
import CategoryToggles from '../../components/CategoryToggles/CategoryToggles.jsx'
import { fetchNearbySpecies, fetchNearbyObservations } from '../../api/inaturalist.js'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import { useGeolocation } from '../../hooks/useGeolocation.js'
import { useCategoryFilter } from '../../hooks/useCategoryFilter.js'
import styles from './NearbyPage.module.css'

const RADIUS_OPTIONS = [1, 5, 10] // 公里

const GEO_MESSAGES = {
  unsupported: '你的瀏覽器不支援定位，請直接在地圖上點選位置',
  denied: '無法取得你的位置（可能未允許定位），請直接在地圖上點選位置',
}

export default function NearbyPage() {
  const { speciesList } = useSpeciesList()
  const { location, isLocating, error: geoError, locate: locateMe, pickLocation } = useGeolocation()
  const [radius, setRadius] = useState(5)
  const [result, setResult] = useState({ status: 'idle', species: [], total: 0, observations: [] })

  const geoMessage = GEO_MESSAGES[geoError] ?? ''

  // 位置或半徑改變時，重新查詢 iNaturalist
  useEffect(() => {
    if (!location) return

    // 使用者快速切換時，取消上一次還沒回來的請求，避免舊資料蓋掉新資料
    const controller = new AbortController()
    setResult((prev) => ({ ...prev, status: 'loading' }))

    Promise.all([
      fetchNearbySpecies({ ...location, radius }, controller.signal),
      fetchNearbyObservations({ ...location, radius }, controller.signal),
    ])
      .then(([speciesResult, observations]) => {
        setResult({ status: 'success', ...speciesResult, observations })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setResult({ status: 'error', species: [], total: 0, observations: [] })
      })

    return () => controller.abort()
  }, [location, radius])

  // 類別開關：關掉的類別，地圖標點和下方卡片一起隱藏
  const filtered = useCategoryFilter(result.species, result.observations, speciesList)
  const nearbySpecies = filtered.species
  const hiddenCategories = filtered.hiddenCategories

  return (
    <div className="container">
      {/* 上方的區塊：和「用外型找找」面板同一種樣式（淡綠色標題列＋白底內容） */}
      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <h1 className={styles.title}>我附近的動物</h1>
        </div>

        <div className={styles.panelBody}>
          <p className={styles.subtitle}>看看你身邊曾經出現過哪些鳥類、哺乳類、爬蟲類、兩棲類、魚類、昆蟲、蜘蛛、蠍子、蜈蚣與甲殼類</p>

          <div className={styles.controls}>
            <button type="button" className={styles.locateButton} onClick={locateMe} disabled={isLocating}>
              <LocationIcon />
              {isLocating ? '定位中…' : '使用我的位置'}
            </button>

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
          </div>

          {/* 這附近有出現的類別：點一下關掉（地圖標點和下方卡片一起隱藏），再點一下打開 */}
          {result.status === 'success' && (
            <CategoryToggles
              categories={filtered.categories}
              hiddenCategories={hiddenCategories}
              onToggle={filtered.toggle}
              className={styles.categories}
            />
          )}
        </div>
      </section>

      <p className={styles.hint}>
        {geoMessage || '也可以直接在地圖上點選任何地點'}
      </p>

      <div className={styles.layout}>
        <div className={styles.mapColumn}>
          <NearbyMap
            location={location}
            radius={radius}
            observations={filtered.observations}
            onPick={pickLocation}
          />
          <ul className={styles.legend}>
            <li><span className={`${styles.dot} ${styles.dotUser}`} />搜尋中心</li>
            <li><span className={`${styles.dot} ${styles.dotObs}`} />最新觀察紀錄</li>
            <li><span className={`${styles.dot} ${styles.dotObscured}`} />位置已模糊化</li>
          </ul>
          <p className={styles.privacy}>
            🔒 你的位置只在瀏覽器中使用，不會被儲存。為保護野生動物，敏感物種的位置已模糊化。
          </p>
        </div>

        <div className={styles.resultColumn}>
          {result.status === 'idle' && (
            <p className={styles.message}>請按「使用我的位置」，或在地圖上點選一個地點</p>
          )}
          {result.status === 'loading' && <p className={styles.message}>正在搜尋附近的動物…</p>}
          {result.status === 'error' && (
            <p className={styles.message}>暫時無法取得資料，請稍後再試</p>
          )}
          {result.status === 'success' && result.total === 0 && (
            <p className={styles.message}>這附近還沒有紀錄，試試擴大搜尋範圍</p>
          )}
          {result.status === 'success' && result.total > 0 && (
            <>
              <p className={styles.count}>
                半徑 {radius} 公里內共發現 <strong>{result.total}</strong> 種
                {hiddenCategories.length > 0
                  ? `（目前顯示 ${nearbySpecies.length} 種）`
                  : result.total > nearbySpecies.length && `（顯示最常見的 ${nearbySpecies.length} 種）`}
              </p>
              {nearbySpecies.length === 0 && (
                <p className={styles.message}>所有類別都關掉了，點上方的類別按鈕打開</p>
              )}
              <ul className={styles.grid}>
                {nearbySpecies.map((species) => (
                  <li key={species.id}>
                    <SpeciesCard species={species} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
