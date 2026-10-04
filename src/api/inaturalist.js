// iNaturalist API（免金鑰）：即時查詢用
const INAT_API = 'https://api.inaturalist.org/v1'

// 第一版的四個類群：鳥類、哺乳類、爬蟲類、兩棲類
const VERTEBRATE_TAXON_IDS = '3,40151,26036,20978'

const ICONIC_TO_GROUP = {
  Aves: 'aves',
  Mammalia: 'mammalia',
  Reptilia: 'reptilia',
  Amphibia: 'amphibia',
}

function buildNearbyParams({ lat, lng, radius }) {
  return new URLSearchParams({
    lat,
    lng,
    radius, // 單位：公里
    taxon_id: VERTEBRATE_TAXON_IDS,
    quality_grade: 'research',
    locale: 'zh-TW',
  })
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
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
      photo: taxon.default_photo?.license_code
        ? {
            url: taxon.default_photo.medium_url,
            author: taxon.default_photo.attribution_name ?? '未知',
            license: taxon.default_photo.license_code.toUpperCase().replace(/^CC-/, 'CC '),
          }
        : null,
    })),
  }
}

// 附近最新的觀察紀錄（地圖上的點）
export async function fetchNearbyObservations(location, signal) {
  const params = buildNearbyParams(location)
  params.set('per_page', 100)
  params.set('order_by', 'observed_on')
  const data = await fetchJson(`${INAT_API}/observations?${params}`, signal)

  return data.results
    .filter((obs) => obs.location)
    .map((obs) => {
      const [lat, lng] = obs.location.split(',').map(Number)
      return {
        id: obs.id,
        lat,
        lng,
        obscured: obs.obscured, // 保育類或使用者自行模糊化的位置
        observedOn: obs.observed_on,
        taxonId: obs.taxon?.id,
        nameZh: obs.taxon?.preferred_common_name ?? null,
        nameSci: obs.taxon?.name,
        photoUrl: obs.photos?.[0]?.url ?? null, // 正方形縮圖
        url: obs.uri,
      }
    })
}
