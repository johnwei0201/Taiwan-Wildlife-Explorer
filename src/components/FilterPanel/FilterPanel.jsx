import { FILTERS, applyFilters } from '../../constants/filters.js'
import styles from './FilterPanel.module.css'

/**
 * 外觀篩選面板：點選類群（例如鳥類）後出現
 *
 * 每個選項後面的數字＝「再加上這個條件後還剩幾種」，
 * 會隨其他條件即時更新；變成 0 的選項不能選，避免選到一筆都沒有
 */
export default function FilterPanel({ list, group, filters, onChange, onClear }) {
  const activeCount = FILTERS.filter((f) => filters[f.key]).length

  return (
    <section className={styles.panel} aria-label="外觀篩選">
      <div className={styles.header}>
        <h2 className={styles.title}>用外觀找找看</h2>
        {activeCount > 0 && (
          <button type="button" className={styles.clear} onClick={onClear}>
            清除條件（{activeCount}）
          </button>
        )}
      </div>

      <div className={styles.grid}>
        {FILTERS.map((filter) => {
          // 套用「其他」條件後的清單，用來計算這個選單每個選項的數量
          const base = applyFilters(list, filters, filter.key)
          const value = filters[filter.key] ?? ''

          return (
            <label key={filter.key} className={styles.field}>
              <span className={styles.label}>{filter.label}</span>
              <select
                className={styles.select}
                data-active={Boolean(value)}
                value={value}
                onChange={(event) => onChange(filter.key, event.target.value)}
              >
                <option value="">不限</option>
                {filter.getOptions(list, group).map((option) => {
                  const count = base.filter((s) => filter.match(s, option.value)).length
                  return (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={count === 0 && option.value !== value}
                    >
                      {option.label}（{count}）
                    </option>
                  )
                })}
              </select>
            </label>
          )
        })}
      </div>

      <p className={styles.note}>大小與顏色為 AI 協助標記，僅供參考</p>
    </section>
  )
}
