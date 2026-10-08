// 農業部「動物認領養」開放資料（免金鑰，政府資料開放授權，需標示來源）
//   全台公立收容所正在等待認養的貓狗，每隻都有照片（部分沒有）、品種、毛色、收容所
//   可以用 animal_kind（貓／狗）、animal_area_pkid（縣市）篩選，$top 限制筆數
const ADOPTION_API = 'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL'

// 縣市代碼（animal_area_pkid）
export const AREAS = [
  { id: 2, name: '臺北市' }, { id: 3, name: '新北市' }, { id: 4, name: '基隆市' },
  { id: 5, name: '宜蘭縣' }, { id: 6, name: '桃園市' }, { id: 7, name: '新竹縣' },
  { id: 8, name: '新竹市' }, { id: 9, name: '苗栗縣' }, { id: 10, name: '臺中市' },
  { id: 11, name: '彰化縣' }, { id: 12, name: '南投縣' }, { id: 13, name: '雲林縣' },
  { id: 14, name: '嘉義縣' }, { id: 15, name: '嘉義市' }, { id: 16, name: '臺南市' },
  { id: 17, name: '高雄市' }, { id: 18, name: '屏東縣' }, { id: 19, name: '花蓮縣' },
  { id: 20, name: '臺東縣' }, { id: 21, name: '澎湖縣' }, { id: 22, name: '金門縣' },
  { id: 23, name: '連江縣' },
]

const SEX_LABELS = { M: '公', F: '母' }
const BODY_LABELS = { SMALL: '小型', MEDIUM: '中型', BIG: '大型' }
const AGE_LABELS = { CHILD: '幼年', ADULT: '成年' }

// 收容所電話欄位的格式不一致（例如「03-4861760桃園市動物」、「039602350分機620」，甚至是一段日期文字）
//   只取第一個 0 開頭的電話號碼；撥號連結裡的「分機」換成逗號（手機撥通後會自動按分機號碼）
function parsePhone(text) {
  const display = text?.match(/0\d[\d-]{6,}(分機\d+)?/)?.[0]
  if (!display) return null
  return { display, href: `tel:${display.replace('分機', ',').replace(/[^\d,]/g, '')}` }
}

// 一次最多抓 60 隻：全台的貓狗加起來有好幾千筆（好幾 MB），只抓最新的一批就好
const MAX_RESULTS = 60

export async function fetchAdoptableAnimals({ kind, areaId }, signal) {
  const params = new URLSearchParams({ animal_kind: kind === 'cat' ? '貓' : '狗', $top: MAX_RESULTS })
  if (areaId) params.set('animal_area_pkid', areaId)
  const res = await fetch(`${ADOPTION_API}&${params}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()

  return (
    data
      .map((a) => ({
        id: a.animal_id,
        photo: a.album_file || null,
        variety: a.animal_Variety?.trim() || null,
        sex: SEX_LABELS[a.animal_sex] ?? null,
        body: BODY_LABELS[a.animal_bodytype] ?? null,
        age: AGE_LABELS[a.animal_age] ?? null,
        colour: a.animal_colour?.trim() || null,
        shelter: a.shelter_name,
        phone: parsePhone(a.shelter_tel),
        openDate: a.animal_opendate,
      }))
      // 有照片的排前面：沒有照片的卡片只能看到 🐾，比較難讓人想認識牠
      .sort((a, b) => Boolean(b.photo) - Boolean(a.photo))
  )
}
