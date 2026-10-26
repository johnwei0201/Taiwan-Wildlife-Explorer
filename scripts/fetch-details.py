"""
物種補充資料腳本（階段一 A）：產生 public/data/species-details.json

為每個物種補上：
  months   ：台灣 1～12 月各有幾筆觀察紀錄（看出「幾月最容易看到」）
  counties ：出現過的縣市與紀錄數（依紀錄數由多到少）

資料來源：iNaturalist（研究級紀錄，和網站收錄物種的標準一致）

做法：「反過來查」，比每個物種各查一次快很多
  每個物種各查一次 → 3,560 種 × 2 種資料 = 7,000 次以上請求
  依月份查（12 個月）、依縣市查（22 縣市），每次列出那段期間／那個地方的所有物種，再整理回每個物種
  → 只要幾百次請求

  第一輪：野生動物，只算研究級紀錄
  第二輪：第一輪查不到的物種，逐一查詢（全部等級的紀錄）
    例如雞、家鴨是「變種」層級（Gallus gallus domesticus），物種統計會把它們合併回上一層的物種（Gallus gallus），
    對不回網站的編號；紀錄也多半是「圈養」，升不到研究級。這類物種只有十幾種，逐一查詢也很快

使用方式（在專案資料夾執行）：
  python scripts/fetch-details.py

每次 API 回應都會存一份快取（scripts/.cache/details/），中斷後重新執行，已經查過的會直接跳過
要抓最新的資料時，把快取資料夾刪掉再執行
"""

import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

INAT_API = 'https://api.inaturalist.org/v1'
TAIWAN_PLACE_ID = 7887
REQUEST_DELAY_SECONDS = 1  # iNaturalist 建議每秒最多 1 個請求
PER_PAGE = 500  # species_counts 一頁最多 500 筆
HEADERS = {'User-Agent': 'TaiwanWildlifeExplorer/0.1 (https://taiwan-wildlife-explorer.vercel.app)'}

ROOT = Path(__file__).resolve().parent.parent
SPECIES_LIST_PATH = ROOT / 'public' / 'data' / 'species-list.json'
OUTPUT_PATH = ROOT / 'public' / 'data' / 'species-details.json'
CACHE_DIR = ROOT / 'scripts' / '.cache' / 'details'

# 網站收錄的類群（iNaturalist 分類編號，和 scripts/fetch-species.js 一致）
GROUP_TAXON_IDS = [
    3,       # 鳥綱
    40151,   # 哺乳綱
    26036,   # 爬行綱
    20978,   # 兩棲綱
    47178,   # 硬骨魚
    47273,   # 鯊魚、魟魚
    47157,   # 鱗翅目（蝴蝶＋蛾）
    47792,   # 蜻蛉目
    47208,   # 鞘翅目
    47744,   # 半翅目
    47651,   # 直翅目
    48112,   # 螳螂目
    47198,   # 竹節蟲目
    47822,   # 雙翅目（蒼蠅、蚊子）
    47201,   # 膜翅目（蜂、螞蟻）
    47119,   # 蛛形綱
    85493,   # 甲殼類
    144128,  # 多足類
]

# 台灣 22 個縣市在 iNaturalist 的地點編號（依內政部的縣市順序）
COUNTIES = [
    ('臺北市', 106960), ('新北市', 106958), ('桃園市', 106961), ('臺中市', 106959),
    ('臺南市', 106962), ('高雄市', 106957), ('基隆市', 106967), ('新竹市', 106956),
    ('嘉義市', 106964), ('新竹縣', 106965), ('苗栗縣', 46478), ('彰化縣', 106963),
    ('南投縣', 46479), ('雲林縣', 46489), ('嘉義縣', 106966), ('屏東縣', 46481),
    ('宜蘭縣', 106968), ('花蓮縣', 46474), ('臺東縣', 46487), ('澎湖縣', 46480),
    ('金門縣', 106954), ('連江縣', 106955),
]


# ---------- 小工具 ----------

def fetch_json(url, retries=3):
    """讀取 API；有快取就直接用快取，失敗時自動重試（等待時間加倍：5、10、20 秒）"""
    cache_file = CACHE_DIR / (hashlib.sha1(url.encode()).hexdigest() + '.json')
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding='utf-8'))

    for attempt in range(retries + 1):
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.load(response)
            break
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt >= retries:
                raise
            wait = 5 * 2 ** attempt
            print(f'  ⚠️ {error}，{wait} 秒後重試…')
            time.sleep(wait)

    time.sleep(REQUEST_DELAY_SECONDS)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    return data


def species_counts(**params):
    """列出符合條件的所有物種與觀察數（自動翻頁）：回傳 {taxon_id: count}"""
    counts = {}
    page = 1
    while True:
        query = urllib.parse.urlencode({**params, 'per_page': PER_PAGE, 'page': page})
        data = fetch_json(f'{INAT_API}/observations/species_counts?{query}')
        for result in data['results']:
            counts[result['taxon']['id']] = result['count']
        if page * PER_PAGE >= data['total_results'] or not data['results']:
            return counts
        page += 1


def collect(wanted_ids, base_params):
    """依月份、依縣市查詢，整理成 {物種 id: {'months': [...], 'counties': {...}}}（只保留 wanted_ids）"""
    details = {}

    def entry(taxon_id):
        return details.setdefault(taxon_id, {'months': [0] * 12, 'counties': {}})

    for month in range(1, 13):
        counts = species_counts(**base_params, place_id=TAIWAN_PLACE_ID, month=month)
        for taxon_id, count in counts.items():
            if taxon_id in wanted_ids:
                entry(taxon_id)['months'][month - 1] = count
        print(f'  {month:>2} 月：{len(counts):>5} 種')

    for name, place_id in COUNTIES:
        counts = species_counts(**base_params, place_id=place_id)
        for taxon_id, count in counts.items():
            if taxon_id in wanted_ids:
                entry(taxon_id)['counties'][name] = count
        print(f'  {name}：{len(counts):>5} 種')

    return details


def per_taxon(taxon_id):
    """逐一查詢一個物種：月份分布＋各縣市紀錄數（全部等級的紀錄；變種也查得到）"""
    query = urllib.parse.urlencode({
        'taxon_id': taxon_id, 'place_id': TAIWAN_PLACE_ID, 'interval': 'month_of_year', 'date_field': 'observed',
    })
    histogram = fetch_json(f'{INAT_API}/observations/histogram?{query}')['results']['month_of_year']
    months = [histogram.get(str(month), 0) for month in range(1, 13)]

    counties = {}
    for name, place_id in COUNTIES:
        query = urllib.parse.urlencode({'taxon_id': taxon_id, 'place_id': place_id, 'per_page': 0})
        total = fetch_json(f'{INAT_API}/observations?{query}')['total_results']
        if total > 0:
            counties[name] = total
    return {'months': months, 'counties': counties}


# ---------- 主程式 ----------

def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')

    species_list = json.loads(SPECIES_LIST_PATH.read_text(encoding='utf-8'))
    all_ids = {s['id'] for s in species_list}
    print(f'網站收錄 {len(all_ids)} 種\n')

    # 第一輪：野生動物（研究級）
    print('【第一輪】研究級紀錄，依月份、依縣市查詢')
    taxon_param = ','.join(str(t) for t in GROUP_TAXON_IDS)
    details = collect(all_ids, {'taxon_id': taxon_param, 'quality_grade': 'research'})

    # 第二輪：第一輪找不到的物種（家養動物的變種、分類已經變動的物種等），逐一查詢
    missing = sorted(all_ids - set(details))
    if missing:
        print(f'\n【第二輪】第一輪找不到的 {len(missing)} 種，逐一查詢（全部等級的紀錄）')
        names = {s['id']: s['nameZh'] or s['nameSci'] for s in species_list}
        for taxon_id in missing:
            item = per_taxon(taxon_id)
            if any(item['months']) or item['counties']:
                details[taxon_id] = item
            print(f"  {names[taxon_id]}：{sum(item['months'])} 筆紀錄、{len(item['counties'])} 個縣市")

    # 輸出：縣市依紀錄數由多到少排列，只保留網站收錄的物種
    output_species = {}
    for species in species_list:
        item = details.get(species['id'])
        if not item:
            continue
        counties = dict(sorted(item['counties'].items(), key=lambda pair: pair[1], reverse=True))
        output_species[str(species['id'])] = {'months': item['months'], 'counties': counties}

    output = {
        'updatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'source': 'iNaturalist（研究級紀錄；家養動物等研究級紀錄不足的物種使用全部等級）',
        'counties': [name for name, _ in COUNTIES],
        'species': output_species,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    # 統計報告
    total = len(species_list)
    with_months = sum(1 for d in output_species.values() if any(d['months']))
    with_counties = sum(1 for d in output_species.values() if d['counties'])
    still_missing = [s['nameZh'] or s['nameSci'] for s in species_list if str(s['id']) not in output_species]
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print('\n========== 統計 ==========')
    print(f'有月份資料：{with_months} / {total}（{with_months / total:.1%}）')
    print(f'有縣市資料：{with_counties} / {total}（{with_counties / total:.1%}）')
    if still_missing:
        print(f'完全沒有資料：{len(still_missing)} 種，例如 {"、".join(still_missing[:10])}')
    print(f'已輸出：{OUTPUT_PATH.relative_to(ROOT)}（{size_kb:.0f} KB）')


if __name__ == '__main__':
    main()
