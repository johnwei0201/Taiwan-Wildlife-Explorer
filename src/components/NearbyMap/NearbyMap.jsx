import { useEffect, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import ObservationMarker from '../ObservationMarker/ObservationMarker.jsx'
import styles from './NearbyMap.module.css'

const TAIWAN_CENTER = [23.7, 120.95]
const TAIWAN_ZOOM = 7

// 點地圖選位置（使用者拒絕定位時的替代方案）
function MapClickHandler({ onPick }) {
  useMapEvents({
    click: (event) => onPick(event.latlng),
  })
  return null
}

// 位置或半徑改變時，自動把地圖移到「剛好看到整個搜尋範圍」
function FitToSearchArea({ location, radius }) {
  const map = useMap()

  useEffect(() => {
    if (!location) return
    const bounds = L.latLng(location.lat, location.lng).toBounds(radius * 2000) // 直徑，單位公尺
    map.flyToBounds(bounds, { duration: 0.8 })
  }, [map, location, radius])

  return null
}

export default function NearbyMap({ location, radius, observations, onPick }) {
  // 圓圈與標點的繪圖範圍：預設只比地圖大 10%，拖動時超出的部分會被切掉
  // padding: 1 代表上下左右各多畫一個地圖的大小（總共 3 倍），拖動時就不會看到切邊
  // 每個地圖各自建立一個（離開頁面再回來時地圖會重建，不能共用）
  const [vectorRenderer] = useState(() => L.svg({ padding: 1 }))

  return (
    <MapContainer
      center={TAIWAN_CENTER}
      zoom={TAIWAN_ZOOM}
      renderer={vectorRenderer}
      className={styles.map}
    >
      {/* OpenStreetMap 免費圖磚：免金鑰，但必須標示來源 */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
        // 手機預設要等手指放開才載入新圖磚，拖動時會看到空白，這裡改成邊拖邊載入
        updateWhenIdle={false}
        // 多保留周圍幾圈已載入的圖磚，拖回來時不用重新下載
        keepBuffer={4}
      />

      <MapClickHandler onPick={onPick} />
      <FitToSearchArea location={location} radius={radius} />

      {location && (
        <>
          {/* 搜尋範圍 */}
          <Circle
            center={location}
            radius={radius * 1000}
            pathOptions={{ color: '#2f6b4f', weight: 2, fillOpacity: 0.06 }}
          />
          {/* 你的位置 */}
          <CircleMarker
            center={location}
            radius={8}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#2b6cd9', fillOpacity: 1 }}
          >
            <Popup>搜尋中心（約略位置）</Popup>
          </CircleMarker>
        </>
      )}

      {observations.map((obs) => (
        <ObservationMarker key={obs.id} observation={obs} />
      ))}
    </MapContainer>
  )
}
