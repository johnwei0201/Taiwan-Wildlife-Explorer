/**
 * 資料整理腳本：產生 public/data/species-list.json
 *
 * 流程：
 *   ① iNaturalist：查詢台灣各類群的物種（依觀察數排序），取得照片與 taxon_id
 *   ② TaiCOL：用學名查詢官方中文名、特有種、保育等級
 *   ③ 合併兩邊資料，輸出 JSON
 *
 * 使用方式：
 *   npm run data                              → 每個類群抓全部物種
 *   npm run data -- --limit=5                 → 每個類群只抓 5 種（測試用）
 *   npm run data -- --groups=lepidoptera,odonata
 *     → 只重抓指定的類群，其他類群保留原本的資料（加入新類群時用，不必全部重抓）
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'

// ---------- 設定 ----------
const INAT_API = 'https://api.inaturalist.org/v1'
const TAICOL_API = 'https://api.taicol.tw/v2'
const TAIWAN_PLACE_ID = 7887
const REQUEST_DELAY_MS = 1000 // iNaturalist 建議每秒最多 1 個請求
const OUTPUT_DIR = 'public/data'

// 收錄的類群（數字是 iNaturalist 的 taxon_id）
//   minCount：台灣研究級觀察數的門檻，低於門檻的物種先不收
//   （昆蟲有些物種只有幾筆紀錄，照片和資料都不完整，先求「完成」再求「完整」）
//   withoutTaxonId：要排除的子類群，例如「蛾」＝鱗翅目扣掉蝴蝶（鳳蝶總科）
const GROUPS = [
  { id: 'aves', label: '鳥類', inatTaxonId: 3 },
  { id: 'mammalia', label: '哺乳類', inatTaxonId: 40151 },
  { id: 'reptilia', label: '爬蟲類', inatTaxonId: 26036 },
  { id: 'amphibia', label: '兩棲類', inatTaxonId: 20978 },
  { id: 'lepidoptera', label: '蝴蝶', inatTaxonId: 47224, minCount: 20 }, // 鳳蝶總科（不含蛾）
  { id: 'moth', label: '蛾', inatTaxonId: 47157, withoutTaxonId: 47224, minCount: 20 }, // 鱗翅目扣掉蝴蝶
  { id: 'odonata', label: '蜻蜓', inatTaxonId: 47792, minCount: 20 }, // 蜻蛉目（蜻蜓＋豆娘）
  { id: 'coleoptera', label: '甲蟲', inatTaxonId: 47208, minCount: 20 }, // 鞘翅目
  { id: 'mantodea', label: '螳螂', inatTaxonId: 48112, minCount: 20 }, // 螳螂目
  { id: 'phasmida', label: '竹節蟲', inatTaxonId: 47198, minCount: 20 }, // 竹節蟲目
  { id: 'hemiptera', label: '蟬、椿象', inatTaxonId: 47744, minCount: 20 }, // 半翅目
  { id: 'orthoptera', label: '蚱蜢、蟋蟀', inatTaxonId: 47651, minCount: 20 }, // 直翅目
  // 魚類在分類上分成好幾綱，這裡兩個設定共用同一個 id，資料會合併成一個類群
  { id: 'fish', label: '魚類（硬骨魚）', inatTaxonId: 47178, minCount: 20 }, // 輻鰭魚綱
  { id: 'fish', label: '魚類（鯊魚、魟魚）', inatTaxonId: 47273, minCount: 20 }, // 板鰓亞綱
  { id: 'crustacea', label: '甲殼類', inatTaxonId: 85493, minCount: 20 }, // 甲殼亞門
  { id: 'araneae', label: '蜘蛛', inatTaxonId: 47118, minCount: 20 }, // 蜘蛛目
]

// 排除清單：家養動物不屬於野生動物圖鑑
const EXCLUDED_NAMES = new Set([
  'Felis catus', // 家貓
  'Canis familiaris', // 家犬
  'Canis lupus familiaris', // 家犬（另一種寫法）
  'Capra hircus', // 家羊
  'Bubalus bubalis', // 水牛
])

// 雜交個體（學名含 ×，例如 Anas platyrhynchos × Cairina moschata）不是一個物種，也排除
const isExcluded = (taxon) => EXCLUDED_NAMES.has(taxon.name) || taxon.name.includes('×')

// 從指令讀取 --limit=數字
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : Infinity

// 從指令讀取 --groups=a,b（沒有指定就是全部類群）
const groupsArg = process.argv.find((arg) => arg.startsWith('--groups='))
const ONLY_GROUPS = groupsArg ? groupsArg.split('=')[1].split(',') : null

// ---------- 小工具 ----------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 失敗時自動重試：跑上千個請求時，偶爾網路不穩或被限速（HTTP 429）很正常，
// 不能因為一次失敗就讓整個腳本停下來。每次重試等待時間加倍（5 秒、10 秒、20 秒）
async function fetchJson(url, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TaiwanWildlifeExplorer/0.1 (portfolio project)' },
      })
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
      (group.withoutTaxonId ? `&without_taxon_id=${group.withoutTaxonId}` : '') +
      `&per_page=${perPage}&page=${page}`
    const data = await fetchJson(url)
    const minCount = group.minCount ?? 0
    results.push(...data.results.filter((r) => !isExcluded(r.taxon) && r.count >= minCount))
    await sleep(REQUEST_DELAY_MS)

    if (page * perPage >= data.total_results) break
    // 結果依觀察數由多到少排列，這一頁最後一筆已經低於門檻，後面的頁就不用查了
    if (data.results.at(-1).count < minCount) break
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
  const groups = ONLY_GROUPS ? GROUPS.filter((g) => ONLY_GROUPS.includes(g.id)) : GROUPS
  const allSpecies = []
  const unmatched = [] // TaiCOL 對不上的物種，之後放進手動對照表

  // 只重抓部分類群時，先保留其他類群原本的資料（包含 enrich 補上的分類、外型、大小、顏色）
  if (ONLY_GROUPS) {
    const previous = JSON.parse(await readFile(`${OUTPUT_DIR}/species-list.json`, 'utf8'))
    const previousMeta = JSON.parse(await readFile(`${OUTPUT_DIR}/meta.json`, 'utf8'))
    const kept = previous.filter((s) => !ONLY_GROUPS.includes(s.group))
    allSpecies.push(...kept)
    unmatched.push(...previousMeta.unmatched.filter((name) => kept.some((s) => s.nameSci === name)))
    console.log(`保留其他類群原本的資料：${kept.length} 種\n`)
  }

  for (const group of groups) {
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

  // 依台灣觀察數由多到少排序：「全部」分頁會先看到常見的動物，而不是 600 多種鳥類排在最前面
  allSpecies.sort((a, b) => b.observationsCount - a.observationsCount)

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
