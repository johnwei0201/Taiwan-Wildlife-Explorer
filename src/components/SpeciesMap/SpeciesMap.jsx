import { useEffect, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import ObservationMarker from '../ObservationMarker/ObservationMarker.jsx'
import GestureHandling from '../GestureHandling/GestureHandling.jsx'
import { heatmapTileUrl } from '../../api/inaturalist.js'
import styles from './SpeciesMap.module.css'

const TAIWAN_CENTER = [23.7, 120.95]
const TAIWAN_ZOOM = 7

// 定位後，把地圖縮放到「剛好看到整個搜尋範圍」；若最近的紀錄在範圍外，也一起框進來
// 清除位置時，回到台灣全圖
// 不用動畫，避免 iPhone 上整頁縮放的問題
function FitView({ location, radius, nearest }) {
  const map = useMap()
  const nearestLat = nearest?.lat
  const nearestLng = nearest?.lng

  useEffect(() => {
    if (!location) {
      map.setView(TAIWAN_CENTER, TAIWAN_ZOOM, { animate: false })
      return
    }
    const bounds = L.latLng(location.lat, location.lng).toBounds(radius * 2000) // 直徑，單位公尺
    if (nearestLat != null) bounds.extend([nearestLat, nearestLng])
    map.fitBounds(bounds, { animate: false, padding: [20, 20] })
  }, [map, location, radius, nearestLat, nearestLng])

  return null
}

/**
 * 物種在台灣的出沒地圖
 *   熱點圖層：所有紀錄的分布
 *   observations：要標在地圖上的紀錄（未定位時是最新紀錄，定位後是附近紀錄）
 *   userLocation / radius：定位後顯示藍點與搜尋範圍
 *   nearest：搜尋範圍內沒有紀錄時，最近的那一筆（地圖會一起框進來）
 *   otherObservations：定位後，附近其他動物的紀錄（綠色小點，畫在這個物種的橘點下面）
 */
export default function SpeciesMap({ taxonId, observations, otherObservations = [], userLocation, radius, nearest }) {
  // 標點的繪圖範圍放大到地圖的 3 倍，拖動時不會被切掉（說明見 NearbyMap）
  const [vectorRenderer] = useState(() => L.svg({ padding: 1 }))

  return (
    // 外框負責圓角與裁切（避開 iPhone Safari 的裁切 bug，說明見 NearbyMap.module.css）
    <div className={styles.frame}>
      <MapContainer
        center={TAIWAN_CENTER}
        zoom={TAIWAN_ZOOM}
        renderer={vectorRenderer}
        className={styles.map}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          updateWhenIdle={false}
          keepBuffer={4}
        />
        {/* iNaturalist 熱點圖層：顏色越深代表紀錄越多 */}
        <TileLayer
          url={heatmapTileUrl(taxonId)}
          attribution='&copy; <a href="https://www.inaturalist.org/">iNaturalist</a>'
          opacity={0.75}
          updateWhenIdle={false}
          keepBuffer={4}
        />

        {/* 防止誤觸：桌機 Ctrl＋滾輪才縮放、手機兩指才移動地圖 */}
        <GestureHandling />
        <FitView location={userLocation} radius={radius} nearest={nearest} />
        {userLocation && (
          <>
            {/* 搜尋範圍 */}
            <Circle
              center={userLocation}
              radius={radius * 1000}
              pathOptions={{ color: '#2f6b4f', weight: 2, fillOpacity: 0.06 }}
            />
          </>
        )}

        {/* 先畫其他動物、再畫這個物種：後畫的在上層，橘點不會被綠點蓋住 */}
        {otherObservations.map((obs) => (
          <ObservationMarker key={`other-${obs.id}`} observation={obs} variant="other" />
        ))}
        {observations.map((obs) => (
          <ObservationMarker key={obs.id} observation={obs} />
        ))}

        {userLocation && (
          <CircleMarker
            center={userLocation}
            radius={8}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#2b6cd9', fillOpacity: 1 }}
          >
            <Popup>你的位置（約略）</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  )
}
