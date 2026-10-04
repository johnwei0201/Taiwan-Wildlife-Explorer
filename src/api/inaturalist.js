// iNaturalist API（免金鑰）：即時查詢用
import { distanceKm } from '../utils/geo.js'

const INAT_API = 'https://api.inaturalist.org/v1'
export const TAIWAN_PLACE_ID = 7887

// 收錄的類群：鳥類、哺乳類、爬蟲類、兩棲類、鱗翅目（蝴蝶＋蛾）、蜻蛉目、鞘翅目、螳螂目、竹節蟲目
const GROUP_TAXON_IDS = '3,40151,26036,20978,47157,47792,47208,48112,47198'

const ICONIC_TO_GROUP = {
  Aves: 'aves',
  Mammalia: 'mammalia',
  Reptilia: 'reptilia',
  Amphibia: 'amphibia',
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// 只接受 CC 授權的照片（license_code 為 null 代表「保留所有權利」，不能用）
function toPhoto(photo) {
  if (!photo?.license_code) return null
  return {
    url: photo.medium_url ?? photo.url?.replace('square', 'medium'),
    largeUrl: photo.large_url ?? photo.url?.replace('square', 'large'),
    author: photo.attribution_name ?? '未知',
    license: photo.license_code === 'cc0' ? 'CC0' : photo.license_code.toUpperCase().replace(/^CC-/, 'CC '),
  }
}

// 觀察紀錄轉成畫面需要的格式（地圖標點、紀錄列表共用）
function toObservation(obs) {
  const [lat, lng] = obs.location.split(',').map(Number)
  return {
    id: obs.id,
    lat,
    lng,
    obscured: obs.obscured, // 保育類或使用者自行模糊化的位置
    observedOn: obs.observed_on,
    placeGuess: obs.place_guess,
    taxonId: obs.taxon?.id,
    nameZh: obs.taxon?.preferred_common_name ?? null,
    nameSci: obs.taxon?.name,
    url: obs.uri,
  }
}

// ---------- 我附近的動物 ----------

function buildNearbyParams({ lat, lng, radius }) {
  return new URLSearchParams({
    lat,
    lng,
    radius, // 單位：公里
    taxon_id: GROUP_TAXON_IDS,
    quality_grade: 'research',
    locale: 'zh-TW',
  })
}

// 附近出現過的物種（依觀察數排序），轉成和 species-list.json 相同的格式，好讓 SpeciesCard 共用
export async function fetchNearbySpecies(location, signal) {
  const params = buildNearbyParams(location)
  params.set('per_page', 60)
  const data = await fetchJson(`${INAT_API}/observations/species_counts?${params}`, signal)

  return {
    total: data.total_results,
    species: data.results.map(({ count, taxon }) => ({
      id: taxon.id,
      group: ICONIC_TO_GROUP[taxon.iconic_taxon_name] ?? null,
      nameZh: taxon.preferred_common_name ?? null,
      nameSci: taxon.name,
      endemic: taxon.preferred_establishment_means === 'endemic',
      nearbyCount: count,
      photo: toPhoto(taxon.default_photo),
    })),
  }
}

// 附近最新的觀察紀錄（地圖上的點）
export async function fetchNearbyObservations(location, signal) {
  const params = buildNearbyParams(location)
  params.set('per_page', 100)
  params.set('order_by', 'observed_on')
  const data = await fetchJson(`${INAT_API}/observations?${params}`, signal)
  return data.results.filter((obs) => obs.location).map(toObservation)
}

// ---------- 物種詳細頁 ----------

// 物種基本資料：名稱、照片、分類階層、維基百科簡介
export async function fetchTaxon(taxonId, signal) {
  const params = new URLSearchParams({ locale: 'zh-TW', preferred_place_id: TAIWAN_PLACE_ID })
  const data = await fetchJson(`${INAT_API}/taxa/${taxonId}?${params}`, signal)
  const taxon = data.results[0]
  if (!taxon) throw new Error('找不到這個物種')

  return {
    id: taxon.id,
    group: ICONIC_TO_GROUP[taxon.iconic_taxon_name] ?? null,
    nameZh: taxon.preferred_common_name ?? null,
    nameSci: taxon.name,
    // 有些物種的英文名欄位其實是中文，只保留含英文字母的名稱
    nameEn: /[a-z]/i.test(taxon.english_common_name ?? '') ? taxon.english_common_name : null,
    endemic: taxon.preferred_establishment_means === 'endemic',
    photos: (taxon.taxon_photos ?? []).map(({ photo }) => toPhoto(photo)).filter(Boolean),
    ancestors: (taxon.ancestors ?? []).map((a) => ({
      id: a.id,
      rank: a.rank,
      nameSci: a.name,
      nameZh: a.preferred_common_name ?? null,
    })),
    // 維基百科簡介含有 <b> 等 HTML 標籤，這裡轉成純文字，避免直接插入 HTML 的安全風險
    summary: taxon.wikipedia_summary?.replace(/<[^>]+>/g, '') ?? null,
  }
}

// 台灣每個月的研究級觀察數：{ 1: 479, 2: 501, ... 12: 538 }
export async function fetchMonthlyCounts(taxonId, signal) {
  const params = new URLSearchParams({
    taxon_id: taxonId,
    place_id: TAIWAN_PLACE_ID,
    quality_grade: 'research',
    date_field: 'observed',
    interval: 'month_of_year',
  })
  const data = await fetchJson(`${INAT_API}/observations/histogram?${params}`, signal)
  return data.results.month_of_year
}

// 台灣最新的觀察紀錄
export async function fetchRecentObservations(taxonId, signal) {
  const params = new URLSearchParams({
    taxon_id: taxonId,
    place_id: TAIWAN_PLACE_ID,
    quality_grade: 'research',
    order_by: 'observed_on',
    per_page: 30,
    locale: 'zh-TW',
  })
  const data = await fetchJson(`${INAT_API}/observations?${params}`, signal)
  return data.results.filter((obs) => obs.location).map(toObservation)
}

// 某物種在使用者附近的紀錄：依距離由近到遠排序，每筆加上 distanceKm
// 半徑內沒有紀錄時，自動擴大到 FALLBACK_RADIUS 公里，找出「最近的紀錄在多遠」
const FALLBACK_RADIUS = 50

async function fetchSpeciesWithin(taxonId, { lat, lng }, radius, signal) {
  const params = new URLSearchParams({
    taxon_id: taxonId,
    lat,
    lng,
    radius,
    quality_grade: 'research',
    per_page: 200,
    locale: 'zh-TW',
  })
  const data = await fetchJson(`${INAT_API}/observations?${params}`, signal)
  const observations = data.results
    .filter((obs) => obs.location)
    .map(toObservation)
    .map((obs) => ({ ...obs, distanceKm: distanceKm({ lat, lng }, obs) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
  return { total: data.total_results, observations }
}

export async function fetchSpeciesNearby(taxonId, location, radius, signal) {
  const within = await fetchSpeciesWithin(taxonId, location, radius, signal)
  if (within.total > 0 || radius >= FALLBACK_RADIUS) {
    return { radius, ...within, searchedRadius: radius }
  }
  const wider = await fetchSpeciesWithin(taxonId, location, FALLBACK_RADIUS, signal)
  return { radius, total: 0, observations: wider.observations, searchedRadius: FALLBACK_RADIUS }
}

// iNaturalist 熱點圖層（疊在 Leaflet 地圖上，顯示所有紀錄的分布）
export function heatmapTileUrl(taxonId) {
  return `${INAT_API}/heatmap/{z}/{x}/{y}.png?taxon_id=${taxonId}&place_id=${TAIWAN_PLACE_ID}&quality_grade=research`
}
