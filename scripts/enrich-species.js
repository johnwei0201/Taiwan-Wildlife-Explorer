/**
 * 資料補充腳本：替 public/data/species-list.json 加上篩選用的欄位
 *
 *   order / family：目、科（iNaturalist 分類，含中文名）
 *   shape：外型（依分類自動判斷，規則在 scripts/shape-rules.js）
 *   size / colors：大小、顏色（來自 scripts/traits.csv，可以用 Excel 直接修改）
 *
 * 使用方式：npm run enrich
 * 已經查過分類的物種不會重複查詢，所以只修改 traits.csv 時，幾秒鐘就跑完
 */
import { readFile, writeFile } from 'node:fs/promises'
import { SHAPE_RULES } from './shape-rules.js'

const INAT_API = 'https://api.inaturalist.org/v1'
const LIST_PATH = 'public/data/species-list.json'
const TRAITS_PATH = 'scripts/traits.csv'
const BATCH_SIZE = 30 // iNaturalist 一次最多查 30 個物種
const REQUEST_DELAY_MS = 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

// ---------- 分類（目、科）與外型 ----------

// 依規則表由上往下比對，第一個符合的規則就是這個物種的外型
function findShape(group, taxonNames) {
  const rule = SHAPE_RULES[group]?.find((r) => r.match.some((name) => taxonNames.includes(name)))
  return rule?.label ?? '其他'
}

async function addTaxonomy(speciesList) {
  const missing = speciesList.filter((s) => !s.family)
  console.log(`需要查詢分類：${missing.length} 種`)

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE)
    const ids = batch.map((s) => s.id).join(',')
    const data = await fetchJson(`${INAT_API}/taxa/${ids}?locale=zh-TW`)
    await sleep(REQUEST_DELAY_MS)

    for (const taxon of data.results) {
      const species = batch.find((s) => s.id === taxon.id)
      if (!species) continue
      const ancestors = taxon.ancestors ?? []
      const pick = (rank) => {
        const a = ancestors.find((x) => x.rank === rank)
        return a ? { nameSci: a.name, nameZh: a.preferred_common_name ?? null } : null
      }
      species.class = pick('class') // 硬骨魚、鯊魚要靠「綱」區分
      species.order = pick('order')
      species.suborder = pick('suborder') // 蜻蜓、豆娘要靠「亞目」區分
      species.infraorder = pick('infraorder') // 螃蟹、寄居蟹、蝦要靠「下目」區分
      species.family = pick('family')
      species.subfamily = pick('subfamily') // 裳蛾科裡的燈蛾、毒蛾要靠「亞科」區分
    }
    console.log(`  已查詢 ${Math.min(i + BATCH_SIZE, missing.length)} / ${missing.length}`)
  }
}

// ---------- 大小與顏色（traits.csv） ----------

// CSV 格式：學名,大小(1~5),顏色(用 / 分隔)
async function readTraits() {
  const text = await readFile(TRAITS_PATH, 'utf8')
  const traits = new Map()
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#') || line.startsWith('nameSci')) continue
    const [nameSci, size, colors] = line.split(',').map((v) => v.trim())
    traits.set(nameSci, {
      size: size ? Number(size) : null,
      colors: colors ? colors.split('/').filter(Boolean) : [],
    })
  }
  return traits
}

// ---------- 主程式 ----------

async function main() {
  const speciesList = JSON.parse(await readFile(LIST_PATH, 'utf8'))
  await addTaxonomy(speciesList)
  const traits = await readTraits()

  for (const species of speciesList) {
    // 外型只依分類階層（綱、目、亞目、下目、科、亞科）判斷：規則簡單，重跑結果也一致
    species.shape = findShape(species.group, [
      species.class?.nameSci,
      species.order?.nameSci,
      species.suborder?.nameSci,
      species.infraorder?.nameSci,
      species.family?.nameSci,
      species.subfamily?.nameSci,
    ])

    const trait = traits.get(species.nameSci)
    species.size = trait?.size ?? null
    species.colors = trait?.colors ?? []
  }

  await writeFile(LIST_PATH, JSON.stringify(speciesList, null, 2))

  // 統計報告
  const count = (fn) => speciesList.filter(fn).length
  console.log('\n========== 統計 ==========')
  console.log(`外型為「其他」：${count((s) => s.shape === '其他')} 種`)
  console.log(`有大小資料：${count((s) => s.size)} / ${speciesList.length}`)
  console.log(`有顏色資料：${count((s) => s.colors.length)} / ${speciesList.length}`)
}

main().catch((error) => {
  console.error('執行失敗：', error.message)
  process.exit(1)
})
