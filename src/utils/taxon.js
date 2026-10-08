// 分類頁（/taxon/:rank/:name）用到的工具：依「綱、目、科、屬」找出物種清單裡的成員
//   每一層：label 中文、get 從物種資料取出該層的學名、getZh 取出中文名、child 下一層
//   屬：沒有資料時，學名的第一個字就是屬名（例如 Canthigaster rivulata → Canthigaster）
export const TAXON_RANKS = {
  class: { label: '綱', get: (s) => s.class?.nameSci, getZh: (s) => s.class?.nameZh, child: 'order' },
  order: { label: '目', get: (s) => s.order?.nameSci, getZh: (s) => s.order?.nameZh, child: 'family' },
  family: { label: '科', get: (s) => s.family?.nameSci, getZh: (s) => s.family?.nameZh, child: 'genus' },
  genus: {
    label: '屬',
    get: (s) => s.genus?.nameSci ?? s.nameSci?.split(' ')[0],
    getZh: (s) => s.genus?.nameZh,
    child: null,
  },
}

// 由大到小，用來畫「綱 › 目 › 科 › 屬」的路徑
export const RANK_ORDER = ['class', 'order', 'family', 'genus']

export const taxonPath = (rank, nameSci) => `/taxon/${rank}/${encodeURIComponent(nameSci)}`

// 雞、鴨（domesticOnly）只在首頁「家養動物」主題下看得到，分類頁和種數都不算它們
export function filterByTaxon(speciesList, rank, nameSci) {
  const get = TAXON_RANKS[rank]?.get
  return get ? speciesList.filter((s) => !s.domesticOnly && get(s) === nameSci) : []
}

// iNaturalist 的中文名有時附上別名，例如「爬行綱 (爬蟲類 爬行類)」，只留第一個
export const cleanZh = (name) => name?.replace(/\s*[(（].*$/, '').trim() || null
