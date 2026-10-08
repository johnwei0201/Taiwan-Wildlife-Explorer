import { CircleMarker, Popup } from 'react-leaflet'
import { formatKm } from '../../utils/geo.js'
import styles from './ObservationMarker.module.css'

// 地圖上的一筆觀察紀錄：一般為實心橘點；位置已模糊化的為空心虛線
//   variant="other"：物種詳細頁定位後，附近「其他動物」的紀錄，改用小一點的綠點，和這個物種的橘點區分
export default function ObservationMarker({ observation: obs, variant }) {
  const isOther = variant === 'other'
  let pathOptions = { color: '#fff', weight: 1, fillColor: '#d98e2b', fillOpacity: 0.9 }
  if (isOther) pathOptions = { color: '#fff', weight: 1, fillColor: '#2f6b4f', fillOpacity: 0.75 }
  if (obs.obscured) {
    pathOptions = { color: isOther ? '#2f6b4f' : '#b5452f', weight: 2, dashArray: '3', fillOpacity: 0.1 }
  }

  return (
    <CircleMarker center={[obs.lat, obs.lng]} radius={isOther ? 4 : 6} pathOptions={pathOptions}>
      <Popup>
        <strong>{obs.nameZh ?? obs.nameSci}</strong>
        <br />
        <i>{obs.nameSci}</i>
        <br />
        觀察日期：{obs.observedOn ?? '不明'}
        {obs.distanceKm != null && (
          <>
            <br />
            距離你約 {formatKm(obs.distanceKm)} 公里
          </>
        )}
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
  )
}
