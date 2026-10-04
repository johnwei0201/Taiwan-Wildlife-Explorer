// 首頁分頁（兩層）
//   kind: 'group'      → 依類群分（id 和 species-list.json 的 group 欄位一致），會出現外觀篩選面板
//   kind: 'collection' → 跨類群的主題（特有種、保育類、外來種），不顯示外觀篩選
//   subgroups          → 第二層小分類：第一層只放「綱」這一級（鳥類、昆蟲類…），
//                        「目」這一級（蝴蝶、蜻蜓…）放在第二層，之後加新類群時第一層不會一直變長
const byGroup = (...ids) => (s) => ids.includes(s.group)

export const GROUPS = [
  { id: 'all', label: '全部', kind: 'all', match: () => true },
  { id: 'aves', label: '鳥類', kind: 'group', match: byGroup('aves') },
  { id: 'mammalia', label: '哺乳類', kind: 'group', match: byGroup('mammalia') },
  { id: 'reptilia', label: '爬蟲類', kind: 'group', match: byGroup('reptilia') },
  { id: 'amphibia', label: '兩棲類', kind: 'group', match: byGroup('amphibia') },
  {
    id: 'insecta',
    label: '昆蟲類',
    kind: 'group',
    match: byGroup('lepidoptera', 'odonata'),
    subgroups: [
      { id: 'lepidoptera', label: '蝴蝶', match: byGroup('lepidoptera') },
      { id: 'odonata', label: '蜻蜓', match: byGroup('odonata') },
    ],
  },
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

// 依網址參數找出目前的分頁：回傳 { group, subgroup }，還沒選分頁時 group 為 null
// 舊網址（例如 /?group=lepidoptera）也能用：會自動找到它的上一層「昆蟲類」
export function findGroup(groupId, subId) {
  const group = GROUPS.find((g) => g.id === groupId)
  if (group) return { group, subgroup: group.subgroups?.find((s) => s.id === subId) ?? null }

  const parent = GROUPS.find((g) => g.subgroups?.some((s) => s.id === groupId))
  if (parent) return { group: parent, subgroup: parent.subgroups.find((s) => s.id === groupId) }

  return { group: null, subgroup: null }
}
