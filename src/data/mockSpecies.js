// 暫時的示意資料：用來確認版面與 RWD
// 之後會換成資料腳本產生的 public/data/species-list.json
export const GROUPS = [
  { id: 'all', label: '全部' },
  { id: 'aves', label: '鳥類' },
  { id: 'mammalia', label: '哺乳類' },
  { id: 'reptilia', label: '爬蟲類' },
  { id: 'amphibia', label: '兩棲類' },
]

export const MOCK_SPECIES = [
  { id: 'mock-1', group: 'aves', nameZh: '臺灣藍鵲', nameSci: 'Urocissa caerulea', endemic: true, protected: true },
  { id: 'mock-2', group: 'aves', nameZh: '帝雉', nameSci: 'Syrmaticus mikado', endemic: true, protected: true },
  { id: 'mock-3', group: 'mammalia', nameZh: '臺灣黑熊', nameSci: 'Ursus thibetanus formosanus', endemic: true, protected: true },
  { id: 'mock-4', group: 'mammalia', nameZh: '石虎', nameSci: 'Prionailurus bengalensis', endemic: false, protected: true },
  { id: 'mock-5', group: 'reptilia', nameZh: '斯文豪氏攀蜥', nameSci: 'Diploderma swinhonis', endemic: true, protected: false },
  { id: 'mock-6', group: 'amphibia', nameZh: '莫氏樹蛙', nameSci: 'Zhangixalus moltrechti', endemic: true, protected: false },
  { id: 'mock-7', group: 'aves', nameZh: '五色鳥', nameSci: 'Psilopogon nuchalis', endemic: true, protected: false },
  { id: 'mock-8', group: 'amphibia', nameZh: '盤古蟾蜍', nameSci: 'Bufo bankorensis', endemic: true, protected: false },
]
