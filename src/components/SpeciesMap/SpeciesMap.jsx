import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import ObservationMarker from '../ObservationMarker/ObservationMarker.jsx'
import { heatmapTileUrl } from '../../api/inaturalist.js'
import styles from './SpeciesMap.module.css'

const TAIWAN_CENTER = [23.7, 120.95]
const TAIWAN_ZOOM = 7

// 物種在台灣的出沒地圖：熱點圖層（所有紀錄）＋最新觀察紀錄
export default function SpeciesMap({ taxonId, observations }) {
  return (
    <MapContainer center={TAIWAN_CENTER} zoom={TAIWAN_ZOOM} className={styles.map}>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      {/* iNaturalist 熱點圖層：顏色越深代表紀錄越多 */}
      <TileLayer
        url={heatmapTileUrl(taxonId)}
        attribution='&copy; <a href="https://www.inaturalist.org/">iNaturalist</a>'
        opacity={0.75}
      />
      {observations.map((obs) => (
        <ObservationMarker key={obs.id} observation={obs} />
      ))}
    </MapContainer>
  )
}
