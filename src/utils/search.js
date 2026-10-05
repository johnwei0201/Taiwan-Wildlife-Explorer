// 文字搜尋：用空格隔開多個關鍵字，每個關鍵字都要出現（順序不拘），例如「台灣 藍」找得到臺灣藍鵲
// 比對範圍：中文名、學名、英文名、科、目（所以輸入「鍬形蟲」「鷺」也能找到整科）

// 統一寫法：英文不分大小寫、「臺」和「台」視為同一個字、全形空格當作一般空格
export function normalize(text) {
  return (text ?? '').toLowerCase().replace(/臺/g, '台').replace(/　/g, ' ')
}

// 把查詢字串拆成關鍵字（多個空格、前後空白都會略過）
export function parseQuery(query) {
  return normalize(query).split(/\s+/).filter(Boolean)
}

// 每個物種可以被搜尋到的文字，事先接成一串，搜尋時只要比對這一串
export function searchText(species) {
  return normalize(
    [
      species.nameZh,
      species.nameSci,
      species.nameEn,
      species.family?.nameZh,
      species.family?.nameSci,
      species.order?.nameZh,
      species.order?.nameSci,
    ].join(' '),
  )
}

export function matchQuery(text, terms) {
  return terms.every((term) => text.includes(term))
}
