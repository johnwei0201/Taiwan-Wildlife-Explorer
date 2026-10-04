import { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
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
  return (
    <MapContainer center={TAIWAN_CENTER} zoom={TAIWAN_ZOOM} className={styles.map}>
      {/* OpenStreetMap 免費圖磚：免金鑰，但必須標示來源 */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
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

      {/* 觀察紀錄：一般為實心橘點；位置已模糊化的為空心虛線 */}
      {observations.map((obs) => (
        <CircleMarker
          key={obs.id}
          center={[obs.lat, obs.lng]}
          radius={6}
          pathOptions={
            obs.obscured
              ? { color: '#b5452f', weight: 2, dashArray: '3', fillOpacity: 0.1 }
              : { color: '#fff', weight: 1, fillColor: '#d98e2b', fillOpacity: 0.9 }
          }
        >
          <Popup>
            <strong>{obs.nameZh ?? obs.nameSci}</strong>
            <br />
            <i>{obs.nameSci}</i>
            <br />
            觀察日期：{obs.observedOn ?? '不明'}
            {obs.obscured && (
              <>
                <br />
                <span className={styles.obscuredNote}>⚠️ 位置已模糊化，僅為大約範圍</span>
              </>
            )}
            <br />
            <a href={obs.url} target="_blank" rel="noreferrer">
              在 iNaturalist 查看 →
            </a>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
