// 篩選條件設定：首頁點選類群後出現的「用外型找找」
//   type: 'select' → 下拉選單（單選）
//   type: 'swatch' → 顏色色塊（可複選，網址上以逗號分隔，例如 color=黑,白）
// 每個篩選的 match 決定「這個物種符不符合目前選的值」

// 大小：1~5 的意思依類群不同（和 scripts/traits.csv 的標準一致）
const SIZE_LABELS = {
  aves: ['麻雀大小或更小', '介於麻雀和鴿子之間', '跟鴿子差不多', '跟烏鴉差不多', '比烏鴉還大'],
  mammalia: ['老鼠大小或更小', '跟松鼠差不多', '跟貓差不多', '跟狗差不多', '比人還大'],
  reptilia: ['比手掌小', '手掌到手臂長', '手臂到一個人長', '比人還長'],
  amphibia: ['比十元硬幣小', '十元硬幣到手掌大', '比手掌還大'],
  lepidoptera: ['比十元硬幣小', '十元硬幣到手掌心', '跟手掌差不多', '比手掌還大'],
  moth: ['比十元硬幣小', '十元硬幣到手掌心', '跟手掌差不多', '比手掌還大'], // 和蝴蝶一樣量展翅寬
  odonata: ['比小指短', '跟小指差不多', '跟中指差不多', '比中指還長'],
  coleoptera: ['比綠豆小', '綠豆到小指甲', '小指甲到十元硬幣', '十元硬幣到大拇指長', '比大拇指還長'],
  mantodea: ['比小指短', '跟中指差不多', '比中指還長'],
  phasmida: ['比中指短', '中指到筷子一半', '比筷子一半還長'],
  hemiptera: ['比綠豆小', '綠豆到小指甲', '小指甲到十元硬幣', '比十元硬幣還長'],
  orthoptera: ['比小指甲短', '小指甲到十元硬幣', '十元硬幣到小指長', '比小指還長'],
  // 蒼蠅、蚊子和蜂、螞蟻都量體長，和蟬、椿象用同一組標準
  diptera: ['比綠豆小', '綠豆到小指甲', '小指甲到十元硬幣', '比十元硬幣還長'],
  hymenoptera: ['比綠豆小', '綠豆到小指甲', '小指甲到十元硬幣', '比十元硬幣還長'],
  fish: ['比小指短', '跟手掌差不多', '手掌到手臂長', '比手臂還長', '超過一公尺'],
  crustacea: ['比小指甲小', '小指甲到十元硬幣', '跟手掌心差不多', '比手掌還大'],
  // 蛛形類：不含腳的體長，蜘蛛、蠍子、盲蛛、蟎都用同一組標準
  arachnida: ['比綠豆小', '綠豆到小指甲', '小指甲到十元硬幣', '比十元硬幣還大'],
  araneae: ['比綠豆小', '綠豆到小指甲', '小指甲到十元硬幣', '比十元硬幣還大'],
  scorpion: ['比綠豆小', '綠豆到小指甲', '小指甲到十元硬幣', '比十元硬幣還大'],
  harvestman: ['比綠豆小', '綠豆到小指甲', '小指甲到十元硬幣', '比十元硬幣還大'],
  mite: ['比綠豆小', '綠豆到小指甲', '小指甲到十元硬幣', '比十元硬幣還大'],
  // 多足類：蜈蚣、馬陸的大小標準相同，所以第一層、第二層都用同一組
  myriapoda: ['比小指短', '跟小指差不多', '跟手掌差不多', '比手掌還長'],
  chilopoda: ['比小指短', '跟小指差不多', '跟手掌差不多', '比手掌還長'],
  diplopoda: ['比小指短', '跟小指差不多', '跟手掌差不多', '比手掌還長'],
  // 家養動物：寵物、家畜用哺乳類的標準，家禽用鳥類的標準（第一層「家養動物」兩種混在一起，要先選小分類）
  pet: ['老鼠大小或更小', '跟松鼠差不多', '跟貓差不多', '跟狗差不多', '比人還大'],
  livestock: ['老鼠大小或更小', '跟松鼠差不多', '跟貓差不多', '跟狗差不多', '比人還大'],
  poultry: ['麻雀大小或更小', '介於麻雀和鴿子之間', '跟鴿子差不多', '跟烏鴉差不多', '比烏鴉還大'],
}

// 顏色色塊：name 對應 traits.csv 的顏色文字，hex 是色塊的顯示顏色
//   ring：選取時外框的顏色＝同一個顏色、彩度再降一些（HSL 飽和度 × 0.8），比色塊本身沉穩
//         黑、灰本來就沒有彩度，維持原色；白色的白框在白底上看不到，改用淺灰
export const COLORS = [
  { name: '黑', hex: '#222222', ring: '#222222' },
  { name: '白', hex: '#ffffff', ring: '#cfcfcf' },
  { name: '灰', hex: '#9e9e9e', ring: '#9e9e9e' },
  { name: '褐', hex: '#8b5a2b', ring: '#815a35' },
  { name: '紅', hex: '#d32f2f', ring: '#c33f3f' },
  { name: '橙', hex: '#f57c00', ring: '#dd7c18' },
  { name: '黃', hex: '#fbc02d', ring: '#e6b742' },
  { name: '綠', hex: '#388e3c', ring: '#418544' },
  { name: '藍', hex: '#1e66c8', ring: '#2f69b7' },
]

// 複選的顏色在網址上用逗號分隔：'黑,白' ↔ ['黑', '白']
export const parseColors = (value) => (value ? value.split(',').filter(Boolean) : [])
export const joinColors = (colors) => colors.join(',')

// 顏色：物種和品種共用（色塊可複選）
const COLOR_FILTER = {
  key: 'color',
  label: '顏色',
  type: 'swatch',
  // 複選＝「同時具備」：選了黑＋白，就只留下身上同時有黑色和白色的動物，選越多範圍越小
  match: (s, value) => parseColors(value).every((color) => s.colors?.includes(color)),
}

export const FILTERS = [
  {
    key: 'shape',
    label: '外型',
    type: 'select',
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
    type: 'select',
    getOptions: (_list, group) =>
      (SIZE_LABELS[group] ?? []).map((label, index) => ({ value: String(index + 1), label })),
    match: (s, value) => s.size === Number(value),
  },
  COLOR_FILTER,
]

// ---------- 貓狗品種（家貓、家犬詳細頁的「品種」區塊） ----------
// 和 scripts/breed-traits.csv 的標準一致；體型依成犬、成貓的體重
const BREED_SIZE_LABELS = {
  dog: ['迷你（4 公斤以下，例如吉娃娃）', '小型（4～10 公斤，例如柴犬）', '中型（10～25 公斤，例如邊境牧羊犬）', '大型（25～45 公斤，例如黃金獵犬）', '超大型（45 公斤以上，例如聖伯納）'],
  cat: ['小型（4 公斤以下）', '中型（4～6 公斤）', '大型（6 公斤以上，例如緬因貓）'],
}

const COAT_TYPES = ['短毛', '長毛', '捲毛', '硬毛', '無毛']

export const BREED_FILTERS = [
  {
    key: 'size',
    label: '體型',
    type: 'select',
    getOptions: (_list, kind) =>
      (BREED_SIZE_LABELS[kind] ?? []).map((label, index) => ({ value: String(index + 1), label })),
    match: (b, value) => b.size === Number(value),
  },
  {
    key: 'coat',
    label: '毛',
    type: 'select',
    // 只列出這一類（貓或狗）有出現的毛種，例如貓沒有「硬毛」
    getOptions: (list) =>
      COAT_TYPES.filter((coat) => list.some((b) => b.coat === coat)).map((coat) => ({ value: coat, label: coat })),
    match: (b, value) => b.coat === value,
  },
  COLOR_FILTER,
]

// 套用所有篩選條件（可以指定略過某一個，用來計算該選項還剩幾種）
//   defs：要套用哪一組篩選（預設是物種的外型、大小、顏色；品種用 BREED_FILTERS）
export function applyFilters(list, filters, skipKey, defs = FILTERS) {
  return list.filter((s) =>
    defs.every((f) => f.key === skipKey || !filters[f.key] || f.match(s, filters[f.key])),
  )
}
