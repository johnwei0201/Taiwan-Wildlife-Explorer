// 首頁分頁（兩層）：單選，決定「看哪一類動物」
//   kind: 'all'   → 全部動物，不顯示外觀篩選
//   kind: 'group' → 依類群分（id 和 species-list.json 的 group 欄位一致），會出現外觀篩選面板
//   subgroups     → 第二層小分類：第一層只放「綱」這一級（鳥類、昆蟲類…），
//                   「目」這一級（蝴蝶、蜻蜓…）放在第二層，之後加新類群時第一層不會一直變長
const byGroup = (...ids) => (s) => ids.includes(s.group)

export const GROUPS = [
  { id: 'all', label: '全部', kind: 'all', match: () => true },
  { id: 'aves', label: '鳥類', kind: 'group', match: byGroup('aves') },
  { id: 'mammalia', label: '哺乳類', kind: 'group', match: byGroup('mammalia') },
  { id: 'reptilia', label: '爬蟲類', kind: 'group', match: byGroup('reptilia') },
  { id: 'amphibia', label: '兩棲類', kind: 'group', match: byGroup('amphibia') },
  { id: 'fish', label: '魚類', kind: 'group', match: byGroup('fish') },
  {
    id: 'insecta',
    label: '昆蟲類',
    kind: 'group',
    match: byGroup('lepidoptera', 'moth', 'odonata', 'coleoptera', 'hemiptera', 'orthoptera', 'mantodea', 'phasmida'),
    subgroups: [
      { id: 'lepidoptera', label: '蝴蝶', match: byGroup('lepidoptera') },
      { id: 'moth', label: '蛾', match: byGroup('moth') },
      { id: 'odonata', label: '蜻蜓', match: byGroup('odonata') },
      { id: 'coleoptera', label: '甲蟲', match: byGroup('coleoptera') },
      { id: 'hemiptera', label: '蟬、椿象', match: byGroup('hemiptera') },
      { id: 'orthoptera', label: '蚱蜢、蟋蟀', match: byGroup('orthoptera') },
      { id: 'mantodea', label: '螳螂', match: byGroup('mantodea') },
      { id: 'phasmida', label: '竹節蟲', match: byGroup('phasmida') },
    ],
  },
  // 蜘蛛有 8 隻腳、身體分兩段，不是昆蟲，屬於蛛形綱；之後的蠍子、盲蛛也放在這裡
  { id: 'arachnida', label: '蛛形類', kind: 'group', match: byGroup('araneae') },
  // 蜈蚣、馬陸腳很多、身體分很多節，也不是昆蟲，屬於多足類；第二層依「綱」分
  {
    id: 'myriapoda',
    label: '多足類',
    kind: 'group',
    match: byGroup('myriapoda'),
    subgroups: [
      { id: 'chilopoda', label: '蜈蚣', match: (s) => s.group === 'myriapoda' && s.class?.nameSci === 'Chilopoda' },
      { id: 'diplopoda', label: '馬陸', match: (s) => s.group === 'myriapoda' && s.class?.nameSci === 'Diplopoda' },
    ],
  },
  { id: 'crustacea', label: '甲殼類', kind: 'group', match: byGroup('crustacea') },
]

// 主題（特有種、保育類、外來種）：可複選，疊加在分頁上，例如「鳥類＋特有種＋保育類」
// 和顏色篩選一樣是「同時具備」：選越多範圍越小（網址上以逗號分隔，例如 tag=endemic,protected）
export const COLLECTIONS = [
  { id: 'endemic', label: '特有種', match: (s) => s.endemic },
  { id: 'protected', label: '保育類', match: (s) => Boolean(s.protectedLevel) },
  // 外來種＝所有不是原生的物種（入侵種、歸化種、栽培豢養），卡片上會標出是哪一種
  { id: 'alien', label: '外來種', match: (s) => Boolean(s.alienType) && s.alienType !== 'native' },
]

export const parseTags = (value) =>
  (value ? value.split(',') : []).filter((id) => COLLECTIONS.some((c) => c.id === id))

// 物種是否同時符合所有選取的主題
export const matchTags = (species, tagIds) =>
  tagIds.every((id) => COLLECTIONS.find((c) => c.id === id).match(species))

// 依網址參數找出目前的分頁：回傳 { group, subgroup }，還沒選分頁時 group 為 null
// 舊網址（例如 /?group=lepidoptera）也能用：會自動找到它的上一層「昆蟲類」
export function findGroup(groupId, subId) {
  const group = GROUPS.find((g) => g.id === groupId)
  if (group) return { group, subgroup: group.subgroups?.find((s) => s.id === subId) ?? null }

  const parent = GROUPS.find((g) => g.subgroups?.some((s) => s.id === groupId))
  if (parent) return { group: parent, subgroup: parent.subgroups.find((s) => s.id === groupId) }

  return { group: null, subgroup: null }
}
