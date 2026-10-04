// 外來種類型（TaiCOL 的 alien_type）
export const ALIEN_LABELS = {
  naturalized: '歸化種',
  invasive: '入侵種',
  cultured: '栽培豢養',
}

// 臺灣紅皮書等級（TaiCOL 的 redlist）
export const REDLIST_LABELS = {
  NEX: '國家滅絕',
  NEW: '野外滅絕',
  NRE: '區域滅絕',
  NCR: '國家極危',
  NEN: '國家瀕危',
  NVU: '國家易危',
  NNT: '國家接近受脅',
  NLC: '暫無危機',
  NDD: '資料缺乏',
}

// 分類階層：詳細頁只顯示這四層
// intro：點「？」時的「分類小教室」說明
export const TAXONOMY_RANKS = [
  {
    rank: 'class',
    label: '綱',
    intro: '「綱」是很大的分類單位，把身體基本構造相同的動物歸在一起。例如鳥綱的成員都有羽毛、會下蛋；哺乳綱的成員都用乳汁哺育寶寶。',
  },
  {
    rank: 'order',
    label: '目',
    intro: '「目」位在「綱」之下，把親緣相近、外型或生活方式相似的「科」歸成一群。例如鷺鷥、鵜鶘、朱鷺都屬於鵜形目。',
  },
  {
    rank: 'family',
    label: '科',
    intro: '「科」位在「目」之下。同一科的動物親緣很近，外型和習性通常也很相似，所以「科」常常是認識動物最好用的一層。',
  },
  {
    rank: 'genus',
    label: '屬',
    intro: '「屬」是「種」的上一層，同屬的物種親緣非常接近。學名的第一個字就是屬名。',
  },
]

// 生物分類的完整階層（由大到小），用來畫「分類小教室」的階層圖
export const RANK_LADDER = [
  { rank: 'kingdom', label: '界' },
  { rank: 'phylum', label: '門' },
  { rank: 'class', label: '綱' },
  { rank: 'order', label: '目' },
  { rank: 'family', label: '科' },
  { rank: 'genus', label: '屬' },
  { rank: 'species', label: '種' },
]
