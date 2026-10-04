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

// 生物分類的完整階層（由大到小）
//   intro：「分類小教室」的說明
//   inTable：是否顯示在詳細頁的分類表（只顯示綱、目、科、屬四層，其他層在「分類小教室」裡點選）
export const TAXONOMY_RANKS = [
  {
    rank: 'kingdom',
    label: '界',
    intro: '「界」是最大的分類單位。所有動物都屬於動物界，和植物界、真菌界等分開。',
  },
  {
    rank: 'phylum',
    label: '門',
    intro: '「門」位在「界」之下，依照身體的基本設計來分。例如身體有脊索（脊椎的前身）的動物都屬於脊索動物門，包含魚、兩棲、爬蟲、鳥和哺乳類。',
  },
  {
    rank: 'class',
    label: '綱',
    inTable: true,
    intro: '「綱」是很大的分類單位，把身體基本構造相同的動物歸在一起。例如鳥綱的成員都有羽毛、會下蛋；哺乳綱的成員都用乳汁哺育寶寶。',
  },
  {
    rank: 'order',
    label: '目',
    inTable: true,
    intro: '「目」位在「綱」之下，把親緣相近、外型或生活方式相似的「科」歸成一群。例如鷺鷥、鵜鶘、朱鷺都屬於鵜形目。',
  },
  {
    rank: 'family',
    label: '科',
    inTable: true,
    intro: '「科」位在「目」之下。同一科的動物親緣很近，外型和習性通常也很相似，所以「科」常常是認識動物最好用的一層。',
  },
  {
    rank: 'genus',
    label: '屬',
    inTable: true,
    intro: '「屬」是「種」的上一層，同屬的物種親緣非常接近。學名的第一個字就是屬名。',
  },
  {
    rank: 'species',
    label: '種',
    intro: '「種」是分類的基本單位。同一種的動物可以互相交配，生下有繁殖能力的後代。學名由「屬名＋種小名」組成，全世界獨一無二。',
  },
]
