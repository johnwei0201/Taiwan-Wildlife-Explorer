/**
 * 資料整理腳本：產生 public/data/species-list.json
 *
 * 流程：
 *   ① iNaturalist：查詢台灣各類群的物種（依觀察數排序），取得照片與 taxon_id
 *   ② TaiCOL：用學名查詢官方中文名、特有種、保育等級
 *   ③ 合併兩邊資料，輸出 JSON
 *
 * 使用方式：
 *   npm run data                 → 每個類群抓全部物種
 *   npm run data -- --limit=5    → 每個類群只抓 5 種（測試用）
 */
import { mkdir, writeFile } from 'node:fs/promises'

// ---------- 設定 ----------
const INAT_API = 'https://api.inaturalist.org/v1'
const TAICOL_API = 'https://api.taicol.tw/v2'
const TAIWAN_PLACE_ID = 7887
const REQUEST_DELAY_MS = 1000 // iNaturalist 建議每秒最多 1 個請求
const OUTPUT_DIR = 'public/data'

// 第一版的四個類群（數字是 iNaturalist 的 taxon_id）
const GROUPS = [
  { id: 'aves', label: '鳥類', inatTaxonId: 3 },
  { id: 'mammalia', label: '哺乳類', inatTaxonId: 40151 },
  { id: 'reptilia', label: '爬蟲類', inatTaxonId: 26036 },
  { id: 'amphibia', label: '兩棲類', inatTaxonId: 20978 },
]

// 排除清單：家養動物不屬於野生動物圖鑑
const EXCLUDED_NAMES = new Set([
  'Felis catus', // 家貓
  'Canis familiaris', // 家犬
  'Canis lupus familiaris', // 家犬（另一種寫法）
])

// 從指令讀取 --limit=數字
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : Infinity

// ---------- 小工具 ----------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'TaiwanWildlifeExplorer/0.1 (portfolio project)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}：${url}`)
  return res.json()
}

// 授權代碼轉成好讀的格式，例如 cc-by-nc → CC BY-NC
function formatLicense(code) {
  if (code === 'cc0') return 'CC0'
  return code.toUpperCase().replace(/^CC-/, 'CC ')
}

// 只接受 CC 授權的照片（license_code 為 null 代表「保留所有權利」，不能用）
function toPhoto(photo) {
  if (!photo?.license_code) return null
  return {
    url: photo.medium_url ?? photo.url.replace('square', 'medium'),
    author: photo.attribution_name ?? '未知',
    license: formatLicense(photo.license_code),
  }
}

// ---------- ① iNaturalist ----------

// 取得某類群在台灣的物種（研究級、依觀察數由多到少）
async function fetchInatSpecies(group) {
  const results = []
  const perPage = Math.min(LIMIT, 500)
  let page = 1

  while (results.length < LIMIT) {
    const url =
      `${INAT_API}/observations/species_counts?place_id=${TAIWAN_PLACE_ID}` +
      `&taxon_id=${group.inatTaxonId}&quality_grade=research&locale=zh-TW` +
      `&per_page=${perPage}&page=${page}`
    const data = await fetchJson(url)
    results.push(...data.results.filter((r) => !EXCLUDED_NAMES.has(r.taxon.name)))
    await sleep(REQUEST_DELAY_MS)

    if (page * perPage >= data.total_results) break
    page++
  }

  return results.slice(0, LIMIT)
}

// 代表照片沒有 CC 授權時，從該物種的其他照片中找一張有授權的
async function findLicensedPhoto(taxonId) {
  const data = await fetchJson(`${INAT_API}/taxa/${taxonId}`)
  await sleep(REQUEST_DELAY_MS)
  const taxonPhotos = data.results[0]?.taxon_photos ?? []
  for (const { photo } of taxonPhotos) {
    const result = toPhoto(photo)
    if (result) return result
  }
  return null
}

// ---------- ② TaiCOL ----------

async function fetchTaicol(scientificName) {
  const url = `${TAICOL_API}/taxon?scientific_name=${encodeURIComponent(scientificName)}`
  const data = await fetchJson(url)
  await sleep(REQUEST_DELAY_MS)
  // 優先使用「有效名（accepted）」的那一筆
  return data.data?.find((t) => t.taxon_status === 'accepted') ?? data.data?.[0] ?? null
}

// ---------- ③ 合併 ----------

async function buildSpecies(group, inatResult) {
  const taxon = inatResult.taxon
  const taicol = await fetchTaicol(taxon.name)

  let photo = toPhoto(taxon.default_photo)
  if (!photo) photo = await findLicensedPhoto(taxon.id)

  return {
    id: taxon.id, // 用 iNaturalist taxon_id 當主鍵，之後即時查詢 API 會用到
    taicolId: taicol?.taxon_id ?? null,
    group: group.id,
    nameZh: taicol?.common_name_c ?? taxon.preferred_common_name ?? null,
    nameSci: taxon.name,
    nameEn: taxon.english_common_name ?? null,
    endemic: taicol ? taicol.is_endemic : taxon.preferred_establishment_means === 'endemic',
    alienType: taicol?.alien_type ?? null, // native 原生 / naturalized 歸化 / invasive 入侵 ...
    protectedLevel: taicol?.protected ?? null, // I / II / III 級保育類，null 代表非保育類
    redlist: taicol?.redlist ?? null, // 臺灣紅皮書等級
    observationsCount: inatResult.count, // 台灣的研究級觀察數，用來排序熱門度
    photo,
  }
}

// ---------- 主程式 ----------

async function main() {
  console.log(`開始整理資料（每個類群上限：${LIMIT === Infinity ? '全部' : LIMIT}）\n`)
  const allSpecies = []
  const unmatched = [] // TaiCOL 對不上的物種，之後放進手動對照表

  for (const group of GROUPS) {
    const inatResults = await fetchInatSpecies(group)
    console.log(`【${group.label}】iNaturalist 取得 ${inatResults.length} 種`)

    for (const result of inatResults) {
      const species = await buildSpecies(group, result)
      allSpecies.push(species)
      if (!species.taicolId) unmatched.push(species.nameSci)

      const marks = [species.taicolId ? '' : '⚠️TaiCOL 對不上', species.photo ? '' : '⚠️無授權照片']
        .filter(Boolean)
        .join(' ')
      console.log(`  ${species.nameZh ?? '（無中文名）'} ${species.nameSci} ${marks}`)
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(`${OUTPUT_DIR}/species-list.json`, JSON.stringify(allSpecies, null, 2))
  await writeFile(
    `${OUTPUT_DIR}/meta.json`,
    JSON.stringify({ updatedAt: new Date().toISOString(), count: allSpecies.length, unmatched }, null, 2),
  )

  // 統計報告
  const withPhoto = allSpecies.filter((s) => s.photo).length
  const withZh = allSpecies.filter((s) => s.nameZh).length
  console.log('\n========== 統計 ==========')
  console.log(`物種總數：${allSpecies.length}`)
  console.log(`TaiCOL 對上：${allSpecies.length - unmatched.length}`)
  console.log(`有中文名：${withZh}`)
  console.log(`有 CC 授權照片：${withPhoto}`)
  console.log(`已輸出：${OUTPUT_DIR}/species-list.json`)
}

main().catch((error) => {
  console.error('執行失敗：', error.message)
  process.exit(1)
})
