/**
 * 貓狗品種腳本：產生 public/data/breeds.json（家貓、家犬詳細頁的「品種」區塊）
 *
 * 流程：
 *   ① Wikidata（CC0）：查出所有「犬種」、「貓種」，只留有中文維基百科條目和照片的
 *   ② 中文維基百科（CC BY-SA）：用台灣用語（zh-tw）取得品種名稱與簡介
 *   ③ Wikimedia Commons：查照片的作者與授權（網站上必須標示）
 *   ④ scripts/breed-traits.csv：合併體型、毛、顏色（外觀篩選用，可以用 Excel 直接修改）
 *
 * 使用方式：
 *   npm run breeds                  → 全部重抓（約 6 分鐘）
 *   npm run breeds -- --traits      → 只把 breed-traits.csv 合併進現有的 breeds.json（幾秒鐘）
 */
import { readFile, writeFile } from 'node:fs/promises'

const OUTPUT_PATH = 'public/data/breeds.json'
const TRAITS_PATH = 'scripts/breed-traits.csv'
const TRAITS_ONLY = process.argv.includes('--traits')
// 維基百科的 API 請求太快會被限速（HTTP 429），每次間隔 1 秒
const REQUEST_DELAY_MS = 1000
// Wikimedia 要求 User-Agent 附上聯絡方式（網址或信箱），沒有的話很容易被限速
const HEADERS = { 'User-Agent': 'TaiwanWildlifeExplorer/0.1 (https://taiwan-wildlife-explorer.vercel.app)' }

// Wikidata 的「犬種」、「貓種」項目
const KINDS = [
  { kind: 'dog', wikidataClass: 'Q39367' },
  { kind: 'cat', wikidataClass: 'Q43577' },
]

// Wikidata 歸在「犬種」、但其實是野生動物的項目，不列入品種
const EXCLUDED_BREEDS = new Set(['dingo'])

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchJson(url, headers = {}, retries = 5) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { ...HEADERS, ...headers } })
      if (!res.ok) throw new Error(`HTTP ${res.status}：${url}`)
      return await res.json()
    } catch (error) {
      if (attempt >= retries) throw error
      const wait = 5000 * 2 ** attempt
      console.warn(`  ⚠️ ${error.message}，${wait / 1000} 秒後重試…`)
      await sleep(wait)
    }
  }
}

// 維基百科簡介裡的拼音注音，例如「暹（xiān）羅貓」的「（xiān）」
const PINYIN_NOTE = /[（(][a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s]+[）)]/gi

// HTML 轉純文字（Commons 的作者欄位、維基百科的標題都可能夾帶 HTML 標籤）
const stripHtml = (html) => html?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null

// ---------- ① Wikidata ----------

// sitelinks：這個項目有幾種語言的維基百科條目，當作「知名度」排序用（越多代表越多人認識）
async function fetchWikidataBreeds(wikidataClass) {
  const query = `
    SELECT ?breed ?nameEn ?image ?sitelinks ?article ?originLabel WHERE {
      ?breed wdt:P31 wd:${wikidataClass} ;
             wdt:P18 ?image ;
             wikibase:sitelinks ?sitelinks .
      ?article schema:about ?breed ; schema:isPartOf <https://zh.wikipedia.org/> .
      OPTIONAL { ?breed rdfs:label ?nameEn FILTER(LANG(?nameEn) = 'en') }
      OPTIONAL { ?breed wdt:P495 ?origin }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-tw,zh-hant,zh,en". }
    } ORDER BY DESC(?sitelinks)`
  const data = await fetchJson(
    `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`,
    { Accept: 'application/sparql-results+json' },
  )

  // 一個品種有好幾張照片或原產國時會出現好幾列，同一個品種只留第一列（原產國合併）
  const breeds = new Map()
  for (const row of data.results.bindings) {
    const id = row.breed.value.split('/').pop()
    const origin = row.originLabel?.value
    const existing = breeds.get(id)
    if (existing) {
      if (origin && !existing.origins.includes(origin)) existing.origins.push(origin)
      continue
    }
    breeds.set(id, {
      id,
      nameEn: row.nameEn?.value ?? null,
      imageFile: decodeURIComponent(row.image.value.split('/').pop()),
      sitelinks: Number(row.sitelinks.value),
      articleTitle: decodeURIComponent(row.article.value.split('/wiki/').pop()),
      origins: origin ? [origin] : [],
    })
  }
  return [...breeds.values()]
}

// ---------- ② 中文維基百科 ----------

// Accept-Language: zh-tw → 維基百科自動轉成台灣用語（例如「金毛尋回犬」→「黃金獵犬」）
async function fetchWikipediaSummary(title) {
  const data = await fetchJson(
    `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    { 'Accept-Language': 'zh-tw' },
  )
  await sleep(REQUEST_DELAY_MS)
  return {
    nameZh: stripHtml(data.titles?.display) ?? data.title,
    // 拿掉拼音注音，例如「暹（xiān）羅貓」→「暹羅貓」
    summary: data.extract?.replace(PINYIN_NOTE, '').trim() || null,
  }
}

// ---------- ③ Wikimedia Commons ----------

// 一次查 50 張照片的縮圖網址、作者、授權
async function fetchImageInfo(files) {
  const result = new Map()
  for (let i = 0; i < files.length; i += 50) {
    const titles = files.slice(i, i + 50).map((f) => `File:${f}`).join('|')
    const data = await fetchJson(
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo' +
        `&iiprop=url|extmetadata&iiurlwidth=500&titles=${encodeURIComponent(titles)}`,
    )
    await sleep(REQUEST_DELAY_MS)

    // Commons 會把檔名的底線轉成空白，對照時統一成空白
    for (const page of Object.values(data.query.pages)) {
      const info = page.imageinfo?.[0]
      const meta = info?.extmetadata ?? {}
      const license = meta.LicenseShortName?.value
      if (!info || !license) continue
      result.set(page.title.replace(/^File:/, ''), {
        url: info.thumburl,
        // 作者欄位有時是一大段 HTML（例如衍生作品的說明），太長就截斷
        author: (stripHtml(meta.Artist?.value) ?? '未知').slice(0, 60),
        license,
        sourceUrl: info.descriptionurl,
      })
    }
  }
  return result
}

// ---------- 主程式 ----------

// ---------- ④ 外觀特徵（breed-traits.csv） ----------

// CSV 格式：Wikidata 編號,英文名,體型(1~5),毛,顏色(用 / 分隔)
async function readTraits() {
  const text = await readFile(TRAITS_PATH, 'utf8')
  const traits = new Map()
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#') || line.startsWith('id,')) continue
    const [id, , size, coat, colors] = line.split(',').map((v) => v.trim())
    traits.set(id, {
      size: size ? Number(size) : null,
      coat: coat || null,
      colors: colors ? colors.split('/').filter(Boolean) : [],
    })
  }
  return traits
}

async function addTraits(breeds) {
  const traits = await readTraits()
  for (const breed of breeds) Object.assign(breed, traits.get(breed.id) ?? { size: null, coat: null, colors: [] })
  const missing = breeds.filter((b) => !traits.has(b.id))
  if (missing.length > 0) {
    console.log(`\n⚠️ 還沒有外觀特徵的品種（請加到 ${TRAITS_PATH}）：`)
    for (const b of missing) console.log(`  ${b.id},${b.nameEn},,,  # ${b.nameZh}`)
  }
}

// ---------- 主程式 ----------

async function main() {
  // 只修改 breed-traits.csv 時，不必重新查 Wikidata、維基百科，直接把特徵合併進現有的 breeds.json
  if (TRAITS_ONLY) {
    const breeds = JSON.parse(await readFile(OUTPUT_PATH, 'utf8'))
    await addTraits(breeds)
    await writeFile(OUTPUT_PATH, JSON.stringify(breeds, null, 2))
    console.log(`已更新 ${breeds.length} 個品種的外觀特徵：${OUTPUT_PATH}`)
    return
  }

  const output = []

  for (const { kind, wikidataClass } of KINDS) {
    const breeds = await fetchWikidataBreeds(wikidataClass)
    console.log(`【${kind === 'dog' ? '犬種' : '貓種'}】Wikidata 取得 ${breeds.length} 種`)

    const images = await fetchImageInfo(breeds.map((b) => b.imageFile))

    for (const breed of breeds.filter((b) => !EXCLUDED_BREEDS.has(b.nameEn))) {
      const photo = images.get(breed.imageFile.replace(/_/g, ' '))
      if (!photo) {
        console.log(`  ⚠️ 照片沒有授權資訊，略過：${breed.nameEn}`)
        continue
      }
      const { nameZh, summary } = await fetchWikipediaSummary(breed.articleTitle)
      output.push({
        id: breed.id,
        kind,
        nameZh,
        nameEn: breed.nameEn,
        origins: breed.origins,
        summary,
        wikipediaUrl: `https://zh.wikipedia.org/zh-tw/${encodeURIComponent(breed.articleTitle)}`,
        popularity: breed.sitelinks,
        photo,
      })
      console.log(`  ${nameZh}（${breed.nameEn}）`)
    }
  }

  await addTraits(output)
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2))
  const count = (kind) => output.filter((b) => b.kind === kind).length
  console.log(`\n犬種 ${count('dog')} 種、貓種 ${count('cat')} 種，已輸出：${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error('執行失敗：', error.message)
  process.exit(1)
})
