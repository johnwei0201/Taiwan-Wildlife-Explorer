import SpeciesCard from '../SpeciesCard/SpeciesCard.jsx'
import styles from './SpeciesGrid.module.css'

// 物種卡片格線：首頁、分類頁共用（手機 2 欄、平板 3 欄、桌機 4 欄）
export default function SpeciesGrid({ list }) {
  return (
    <ul className={styles.grid}>
      {list.map((species) => (
        <li key={species.id}>
          <SpeciesCard species={species} />
        </li>
      ))}
    </ul>
  )
}
