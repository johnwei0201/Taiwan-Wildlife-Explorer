import { COLORS, FILTERS, applyFilters, joinColors, parseColors } from '../../constants/filters.js'
import styles from './FilterPanel.module.css'

/**
 * 外觀篩選面板：點選類群（例如鳥類）後出現
 *   外型、大小：下拉選單，選項後面的數字＝「選了之後還剩幾種」
 *   顏色：圓形色塊，可以複選，選越多範圍越小
 * 會變成 0 種的選項不能選，避免選到一筆都沒有
 */
export default function FilterPanel({ list, group, filters, onChange, onClear }) {
  const activeCount = FILTERS.filter((f) => filters[f.key]).length

  return (
    <section className={styles.panel} aria-label="外觀篩選">
      <div className={styles.header}>
        <h2 className={styles.title}>用外觀找找看</h2>
        {activeCount > 0 && (
          <button type="button" className={styles.clear} onClick={onClear}>
            清除條件
          </button>
        )}
      </div>

      <div className={styles.grid}>
        {FILTERS.map((filter) =>
          filter.type === 'swatch' ? (
            <ColorSwatches
              key={filter.key}
              filter={filter}
              list={list}
              filters={filters}
              onChange={onChange}
            />
          ) : (
            <SelectFilter
              key={filter.key}
              filter={filter}
              list={list}
              group={group}
              filters={filters}
              onChange={onChange}
            />
          ),
        )}
      </div>

      <p className={styles.note}>大小與顏色為 AI 協助標記，僅供參考</p>
    </section>
  )
}

// ---------- 下拉選單（外型、大小） ----------
function SelectFilter({ filter, list, group, filters, onChange }) {
  // 套用「其他」條件後的清單，用來計算這個選單每個選項的數量
  const base = applyFilters(list, filters, filter.key)
  const value = filters[filter.key] ?? ''

  return (
    <label className={styles.field}>
      <span className={styles.label}>{filter.label}</span>
      <select
        className={styles.select}
        data-active={Boolean(value)}
        value={value}
        onChange={(event) => onChange(filter.key, event.target.value)}
      >
        <option value="">不確定</option>
        {filter.getOptions(list, group).map((option) => {
          const count = base.filter((s) => filter.match(s, option.value)).length
          return (
            <option key={option.value} value={option.value} disabled={count === 0 && option.value !== value}>
              {option.label}（{count}）
            </option>
          )
        })}
      </select>
    </label>
  )
}

// ---------- 顏色色塊（可複選） ----------
function ColorSwatches({ filter, list, filters, onChange }) {
  const selected = parseColors(filters[filter.key])

  // 點一下選取，再點一下取消
  const toggle = (name) => {
    const next = selected.includes(name) ? selected.filter((c) => c !== name) : [...selected, name]
    onChange(filter.key, joinColors(next))
  }

  // 每個色塊「加選之後還剩幾種」：用其他條件＋目前已選的顏色＋這個顏色來計算
  const base = applyFilters(list, filters, filter.key)
  const countWith = (name) => {
    const colors = selected.includes(name) ? selected : [...selected, name]
    return base.filter((s) => colors.every((c) => s.colors?.includes(c))).length
  }

  return (
    <div className={`${styles.field} ${styles.colorField}`} role="group" aria-label="顏色（可複選）">
      <span className={styles.label}>
        {filter.label}
        <span className={styles.labelHint}>（可複選）</span>
      </span>
      {/* 和外型、大小一樣的長方形框：顯示目前選了哪些顏色 */}
      <div className={`${styles.select} ${styles.colorDisplay}`} data-active={selected.length > 0} aria-live="polite">
        {selected.length > 0 ? selected.map((c) => `${c}色`).join('＋') : '不確定'}
      </div>
      <ul className={styles.swatches}>
        {COLORS.map(({ name, hex }) => {
          const isSelected = selected.includes(name)
          const count = countWith(name)
          const disabled = count === 0 && !isSelected
          return (
            <li key={name}>
              <button
                type="button"
                className={styles.swatch}
                style={{ '--swatch': hex }}
                aria-pressed={isSelected}
                aria-label={`${name}色（${count} 種）`}
                title={`${name}色（${count} 種）`}
                disabled={disabled}
                onClick={() => toggle(name)}
              />
            </li>
          )
        })}
        <li>
          <button
            type="button"
            className={styles.clearColors}
            disabled={selected.length === 0}
            onClick={() => onChange(filter.key, '')}
          >
            清除
          </button>
        </li>
      </ul>
    </div>
  )
}
