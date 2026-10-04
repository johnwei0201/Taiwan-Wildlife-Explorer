// 首頁分頁
//   kind: 'group'      → 依類群分（id 和 species-list.json 的 group 欄位一致），會出現外觀篩選面板
//   kind: 'collection' → 跨類群的主題（特有種、保育類、入侵種），不顯示外觀篩選
export const GROUPS = [
  { id: 'all', label: '全部', kind: 'all', match: () => true },
  { id: 'aves', label: '鳥類', kind: 'group', match: (s) => s.group === 'aves' },
  { id: 'mammalia', label: '哺乳類', kind: 'group', match: (s) => s.group === 'mammalia' },
  { id: 'reptilia', label: '爬蟲類', kind: 'group', match: (s) => s.group === 'reptilia' },
  { id: 'amphibia', label: '兩棲類', kind: 'group', match: (s) => s.group === 'amphibia' },
  { id: 'endemic', label: '特有種', kind: 'collection', match: (s) => s.endemic },
  { id: 'protected', label: '保育類', kind: 'collection', match: (s) => Boolean(s.protectedLevel) },
  { id: 'invasive', label: '入侵種', kind: 'collection', match: (s) => s.alienType === 'invasive' },
]
