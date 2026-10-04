// 首頁分頁
//   kind: 'group'      → 依類群分（id 和 species-list.json 的 group 欄位一致），會出現外觀篩選面板
//   kind: 'collection' → 跨類群的主題（特有種、保育類、外來種），不顯示外觀篩選
export const GROUPS = [
  { id: 'all', label: '全部', kind: 'all', match: () => true },
  { id: 'aves', label: '鳥類', kind: 'group', match: (s) => s.group === 'aves' },
  { id: 'mammalia', label: '哺乳類', kind: 'group', match: (s) => s.group === 'mammalia' },
  { id: 'reptilia', label: '爬蟲類', kind: 'group', match: (s) => s.group === 'reptilia' },
  { id: 'amphibia', label: '兩棲類', kind: 'group', match: (s) => s.group === 'amphibia' },
  { id: 'endemic', label: '特有種', kind: 'collection', match: (s) => s.endemic },
  { id: 'protected', label: '保育類', kind: 'collection', match: (s) => Boolean(s.protectedLevel) },
  // 外來種＝所有不是原生的物種（入侵種、歸化種、栽培豢養），卡片上會標出是哪一種
  {
    id: 'alien',
    label: '外來種',
    kind: 'collection',
    match: (s) => Boolean(s.alienType) && s.alienType !== 'native',
  },
]
