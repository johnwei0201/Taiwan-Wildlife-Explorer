import styles from './CategoryToggles.module.css'

// 附近有出現的類別：點一下關掉（地圖標點和清單一起隱藏），再點一下打開
//   開著是綠底白字，關掉是白底灰字；數字是這一類的種數
export default function CategoryToggles({ categories, hiddenCategories, onToggle, className = '' }) {
  if (categories.length === 0) return null

  return (
    <div className={`${styles.categories} ${className}`} role="group" aria-label="顯示的類別">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          aria-pressed={!hiddenCategories.includes(category.id)}
          className={styles.categoryButton}
          onClick={() => onToggle(category.id)}
        >
          {category.label}
          <span className={styles.categoryCount}>{category.count}</span>
        </button>
      ))}
    </div>
  )
}
