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
export const TAXONOMY_RANKS = [
  { rank: 'class', label: '綱' },
  { rank: 'order', label: '目' },
  { rank: 'family', label: '科' },
  { rank: 'genus', label: '屬' },
]
