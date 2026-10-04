// 篩選條件設定：首頁點選類群後出現的下拉選單
// 每個篩選的 match 決定「這個物種符不符合這個選項」

// 大小：1~5 的意思依類群不同（和 scripts/traits.csv 的標準一致）
const SIZE_LABELS = {
  aves: ['麻雀大小或更小', '介於麻雀和鴿子之間', '跟鴿子差不多', '跟烏鴉差不多', '比烏鴉還大'],
  mammalia: ['老鼠大小或更小', '跟松鼠差不多', '跟貓差不多', '跟狗差不多', '比人還大'],
  reptilia: ['比手掌小', '手掌到手臂長', '手臂到一個人長', '比人還長'],
  amphibia: ['比十元硬幣小', '十元硬幣到手掌大', '比手掌還大'],
}

const COLORS = ['黑', '白', '灰', '褐', '紅', '橙', '黃', '綠', '藍']

const TAGS = {
  endemic: { label: '臺灣特有種', match: (s) => s.endemic },
  protected: { label: '保育類', match: (s) => Boolean(s.protectedLevel) },
  alien: { label: '外來種', match: (s) => Boolean(s.alienType) && s.alienType !== 'native' },
}

// 常見程度：依台灣的研究級觀察數
const RARITY = {
  common: { label: '常見', match: (s) => s.observationsCount >= 500 },
  occasional: { label: '偶爾可見', match: (s) => s.observationsCount >= 50 && s.observationsCount < 500 },
  rare: { label: '少見', match: (s) => s.observationsCount < 50 },
}

export const FILTERS = [
  {
    key: 'shape',
    label: '外型',
    // 選項從資料產生，依物種數由多到少排列
    getOptions: (list) => {
      const counts = new Map()
      for (const s of list) counts.set(s.shape, (counts.get(s.shape) ?? 0) + 1)
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([shape]) => ({ value: shape, label: shape }))
    },
    match: (s, value) => s.shape === value,
  },
  {
    key: 'size',
    label: '大小',
    getOptions: (_list, group) =>
      (SIZE_LABELS[group] ?? []).map((label, index) => ({ value: String(index + 1), label })),
    match: (s, value) => s.size === Number(value),
  },
  {
    key: 'color',
    label: '顏色',
    getOptions: () => COLORS.map((color) => ({ value: color, label: `有${color}色` })),
    match: (s, value) => s.colors?.includes(value),
  },
  {
    key: 'tag',
    label: '標籤',
    getOptions: () => Object.entries(TAGS).map(([value, { label }]) => ({ value, label })),
    match: (s, value) => TAGS[value]?.match(s),
  },
  {
    key: 'rarity',
    label: '常見程度',
    getOptions: () => Object.entries(RARITY).map(([value, { label }]) => ({ value, label })),
    match: (s, value) => RARITY[value]?.match(s),
  },
]

// 套用所有篩選條件（可以指定略過某一個，用來計算該選單每個選項還剩幾種）
export function applyFilters(list, filters, skipKey) {
  return list.filter((s) =>
    FILTERS.every((f) => f.key === skipKey || !filters[f.key] || f.match(s, filters[f.key])),
  )
}
