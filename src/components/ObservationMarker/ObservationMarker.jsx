import { CircleMarker, Popup } from 'react-leaflet'
import styles from './ObservationMarker.module.css'

// 地圖上的一筆觀察紀錄：一般為實心橘點；位置已模糊化的為空心虛線
export default function ObservationMarker({ observation: obs }) {
  return (
    <CircleMarker
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
  )
}
