/**
 * 幼蟲照片腳本：替蝴蝶、蛾找一張毛毛蟲（幼蟲）的照片，存進 public/data/species-list.json
 *
 *   larvaPhoto：{ url, author, license, observationUrl }，找不到 CC 授權的幼蟲照片時是 null
 *   larvaCount：iNaturalist 上標註「幼蟲」的研究級紀錄數
 *
 * 首頁「昆蟲類 › 毛毛蟲」的卡片用這張照片；如果在首頁即時查詢，一次要查幾百種，會非常慢
 *
 * 使用方式：npm run larva
 * 已經查過的物種（有 larvaPhoto 欄位，包含 null）不會重查，中途中斷了重跑會從沒查過的繼續
 */
import { readFile, writeFile } from 'node:fs/promises'

const INAT_API = 'https://api.inaturalist.org/v1'
const LIST_PATH = 'public/data/species-list.json'
const REQUEST_DELAY_MS = 1000 // iNaturalist 建議每秒最多 1 個請求
const SAVE_EVERY = 50 // 每查 50 種存檔一次，中斷時不會全部白費
const LARVA_GROUPS = ['lepidoptera', 'moth'] // 蝴蝶、蛾

const LIFE_STAGE_TERM = 1 // 標註項目「生命階段」
const LIFE_STAGE_LARVA = 6 // 標註值「幼蟲」
const CC_LICENSES = 'cc0,cc-by,cc-by-nc,cc-by-sa,cc-by-nd,cc-by-nc-sa,cc-by-nc-nd'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// 失敗時自動重試，每次等待時間加倍（5 秒、10 秒、20 秒）
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

function formatLicense(code) {
  if (code === 'cc0') return 'CC0'
  return code.toUpperCase().replace(/^CC-/, 'CC ')
}

// 依按讚數排序取第一筆：通常是拍得最清楚的
async function fetchLarva(taxonId) {
  const params = new URLSearchParams({
    taxon_id: taxonId,
    term_id: LIFE_STAGE_TERM,
    term_value_id: LIFE_STAGE_LARVA,
    photos: true,
    photo_license: CC_LICENSES,
    quality_grade: 'research',
    order_by: 'votes',
    per_page: 1,
  })
  const data = await fetchJson(`${INAT_API}/observations?${params}`)
  const obs = data.results[0]
  const photo = obs?.photos?.find((p) => p.license_code)
  return {
    larvaCount: data.total_results,
    larvaPhoto: photo
      ? {
          url: photo.url.replace('square', 'medium'),
          // 觀察紀錄的照片沒有作者欄位，作者就是上傳的人：有填名字用名字，沒填就用帳號
          author: obs.user?.name || obs.user?.login || '未知',
          license: formatLicense(photo.license_code),
          observationUrl: obs.uri,
        }
      : null,
  }
}

async function main() {
  const speciesList = JSON.parse(await readFile(LIST_PATH, 'utf8'))
  const targets = speciesList.filter((s) => LARVA_GROUPS.includes(s.group) && !('larvaPhoto' in s))
  console.log(`需要查詢幼蟲照片：${targets.length} 種`)

  for (const [index, species] of targets.entries()) {
    Object.assign(species, await fetchLarva(species.id))
    await sleep(REQUEST_DELAY_MS)
    const mark = species.larvaPhoto ? `✓ ${species.larvaCount} 筆` : '（沒有幼蟲照片）'
    console.log(`  ${index + 1}/${targets.length} ${species.nameZh ?? species.nameSci} ${mark}`)
    if ((index + 1) % SAVE_EVERY === 0) await writeFile(LIST_PATH, JSON.stringify(speciesList, null, 2))
  }

  await writeFile(LIST_PATH, JSON.stringify(speciesList, null, 2))

  const all = speciesList.filter((s) => LARVA_GROUPS.includes(s.group))
  console.log('\n========== 統計 ==========')
  console.log(`蝴蝶、蛾：${all.length} 種，有幼蟲照片：${all.filter((s) => s.larvaPhoto).length} 種`)
}

main().catch((error) => {
  console.error('執行失敗：', error.message)
  process.exit(1)
})
