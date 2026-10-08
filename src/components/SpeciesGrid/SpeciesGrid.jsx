import SpeciesCard from '../SpeciesCard/SpeciesCard.jsx'
import styles from './SpeciesGrid.module.css'

// 物種卡片格線：首頁、分類頁共用（手機 2 欄、平板 3 欄、桌機 4 欄）
export default function SpeciesGrid({ list }) {
  return (
    <ul className={styles.grid}>
      {/* key 包含照片網址：同一物種換了照片（例如成蟲 → 幼蟲）時重新建立卡片，重新顯示載入動畫 */}
      {list.map((species) => (
        <li key={`${species.id}-${species.photo?.url ?? ''}`}>
          <SpeciesCard species={species} />
        </li>
      ))}
    </ul>
  )
}
