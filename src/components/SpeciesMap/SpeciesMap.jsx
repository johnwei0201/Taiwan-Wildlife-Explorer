import { useEffect, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import ObservationMarker from '../ObservationMarker/ObservationMarker.jsx'
import { heatmapTileUrl } from '../../api/inaturalist.js'
import styles from './SpeciesMap.module.css'

const TAIWAN_CENTER = [23.7, 120.95]
const TAIWAN_ZOOM = 7

const USER_ZOOM = 12 // 大約看得到周圍 10 公里

// 取得使用者位置後，把地圖移過去（不用動畫，避免 iPhone 上整頁縮放的問題）
function MoveToUser({ location }) {
  const map = useMap()
  useEffect(() => {
    if (location) map.setView([location.lat, location.lng], USER_ZOOM, { animate: false })
  }, [map, location])
  return null
}

// 物種在台灣的出沒地圖：熱點圖層（所有紀錄）＋最新觀察紀錄＋使用者位置（選用）
export default function SpeciesMap({ taxonId, observations, userLocation }) {
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
        {observations.map((obs) => (
          <ObservationMarker key={obs.id} observation={obs} />
        ))}

        <MoveToUser location={userLocation} />
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
