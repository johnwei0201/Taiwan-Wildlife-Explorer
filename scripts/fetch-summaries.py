"""
物種維基簡介腳本（階段一 B）：產生 public/data/species-summaries.json

為每個物種抓中文維基百科的簡介（台灣用語），作為「棲地、食性」的來源，也是之後 RAG 檢索的主要文字資料

找條目的順序（越前面越準）：
  ① Wikidata：物種項目記有 iNaturalist 編號（P3151）和中文維基條目，用編號比對，不會因為同名找錯
     一次查 600 種，3,560 種只要 6 次查詢
  ② 中文名：Wikidata 沒有記錄的物種，用中文名查維基百科（維基會自動導向正式條目）
  ③ 學名：中文名也查不到，再用學名查（很多條目有學名的重新導向）
  消歧義頁（同名的多個條目）沒有實際內容，當作查不到

簡介用維基百科的 REST API 抓取，指定 Accept-Language: zh-tw → 自動轉成台灣正體中文

使用方式（在專案資料夾執行）：
  python scripts/fetch-summaries.py

每次請求都會存一份快取（scripts/.cache/summaries/），中斷後重新執行，已經查過的會直接跳過
3,560 種約需 30～60 分鐘（大部分時間花在補找 ②③）
"""

import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

WIKI_REST = 'https://zh.wikipedia.org/api/rest_v1/page/summary'
WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'
# Wikimedia 要求 User-Agent 附上聯絡方式（網址或信箱），沒有的話很容易被限速（HTTP 429）
HEADERS = {'User-Agent': 'TaiwanWildlifeExplorer/0.1 (https://taiwan-wildlife-explorer.vercel.app)'}
REQUEST_DELAY_SECONDS = 0.5
WIKIDATA_CHUNK = 600

ROOT = Path(__file__).resolve().parent.parent
SPECIES_LIST_PATH = ROOT / 'public' / 'data' / 'species-list.json'
OUTPUT_PATH = ROOT / 'public' / 'data' / 'species-summaries.json'
CACHE_DIR = ROOT / 'scripts' / '.cache' / 'summaries'

# 統計用：簡介裡有沒有提到棲地、食性（只是粗略判斷，用來估計資料完整度）
HABITAT_PATTERN = re.compile(r'棲息|棲地|生活於|生活在|分布於|分佈於|出沒|海拔|森林|溪流|濕地|草原|海域|洞穴')
DIET_PATTERN = re.compile(r'為食|捕食|食物|主食|食性|取食|覓食|吃|吸食|草食|肉食|雜食|食蟲')


# ---------- 小工具 ----------

def cached_request(cache_key, do_request, retries=3):
    """有快取就用快取；沒有就送出請求、存快取。失敗時自動重試（等待時間加倍：5、10、20 秒）"""
    cache_file = CACHE_DIR / (hashlib.sha1(cache_key.encode()).hexdigest() + '.json')
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding='utf-8'))

    for attempt in range(retries + 1):
        try:
            result = do_request()
            break
        except urllib.error.HTTPError as error:
            if error.code == 404:
                result = None  # 查不到也存快取，重跑時不必再查
                break
            if attempt >= retries:
                # 單一條目一直出錯（例如維基百科的 HTTP 500）：跳過這一筆，不要讓整個腳本停下來
                # 不存快取，下次執行時會再試一次
                print(f'  ⚠️ HTTP {error.code} 重試 {retries} 次仍失敗，先跳過：{cache_key}')
                return None
            wait = 5 * 2 ** attempt
            print(f'  ⚠️ HTTP {error.code}，{wait} 秒後重試…')
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt >= retries:
                raise
            wait = 5 * 2 ** attempt
            print(f'  ⚠️ {error}，{wait} 秒後重試…')
            time.sleep(wait)

    time.sleep(REQUEST_DELAY_SECONDS)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    return result


def wikidata_titles(inat_ids):
    """① Wikidata：iNaturalist 編號 → 中文維基條目名稱"""
    titles = {}
    for start in range(0, len(inat_ids), WIKIDATA_CHUNK):
        chunk = inat_ids[start:start + WIKIDATA_CHUNK]
        values = ' '.join(f'"{taxon_id}"' for taxon_id in chunk)
        query = f'''
            SELECT ?inat ?article WHERE {{
              VALUES ?inat {{ {values} }}
              ?item wdt:P3151 ?inat .
              ?article schema:about ?item ; schema:isPartOf <https://zh.wikipedia.org/> .
            }}'''

        def do_request():
            request = urllib.request.Request(
                WIKIDATA_SPARQL,
                data=urllib.parse.urlencode({'query': query}).encode(),
                headers={**HEADERS, 'Accept': 'application/sparql-results+json'},
            )
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.load(response)['results']['bindings']

        for row in cached_request(f'wikidata:{",".join(map(str, chunk))}', do_request):
            title = urllib.parse.unquote(row['article']['value'].split('/wiki/')[-1])
            titles[int(row['inat']['value'])] = title
    return titles


def wiki_summary(title):
    """抓維基簡介（台灣用語）；查不到或是消歧義頁就回傳 None"""
    def do_request():
        url = f'{WIKI_REST}/{urllib.parse.quote(title, safe="")}'
        request = urllib.request.Request(url, headers={**HEADERS, 'Accept-Language': 'zh-tw'})
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)

    data = cached_request(f'summary:{title}', do_request)
    if not data or data.get('type') == 'disambiguation' or not data.get('extract'):
        return None
    return {
        'title': re.sub(r'<[^>]+>', '', data.get('titles', {}).get('display') or data.get('title', title)),
        'url': f'https://zh.wikipedia.org/zh-tw/{urllib.parse.quote(data.get("title", title))}',
        'summary': data['extract'].strip(),
    }


# ---------- 主程式 ----------

def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')

    species_list = json.loads(SPECIES_LIST_PATH.read_text(encoding='utf-8'))
    print(f'網站收錄 {len(species_list)} 種\n')

    print('① Wikidata：用 iNaturalist 編號找中文維基條目')
    titles = wikidata_titles([s['id'] for s in species_list])
    print(f'  找到 {len(titles)} 種\n')

    print('② ③ 抓簡介；Wikidata 沒有的物種改用中文名、學名查詢（每 200 種回報一次進度）')
    output_species = {}
    matched_by = {'wikidata': 0, 'nameZh': 0, 'nameSci': 0}
    for index, species in enumerate(species_list, start=1):
        candidates = []
        if species['id'] in titles:
            candidates.append(('wikidata', titles[species['id']]))
        else:
            # 中文名後面的括號別名拿掉再查，例如「白斑蛾蚋 (大蛾蚋)」→「白斑蛾蚋」
            name_zh = re.sub(r'\s*[（(].*$', '', species.get('nameZh') or '').strip()
            if name_zh:
                candidates.append(('nameZh', name_zh))
            candidates.append(('nameSci', species['nameSci']))

        for source, title in candidates:
            result = wiki_summary(title)
            if result:
                output_species[str(species['id'])] = {**result, 'matchedBy': source}
                matched_by[source] += 1
                break

        if index % 200 == 0 or index == len(species_list):
            print(f'  {index} / {len(species_list)}，目前找到 {len(output_species)} 種')

    output = {
        'updatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'source': '中文維基百科（CC BY-SA 4.0），台灣正體中文',
        'species': output_species,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    # 統計報告：覆蓋率（依類群）、有提到棲地／食性的比例
    total = len(species_list)
    found = len(output_species)
    summaries = [item['summary'] for item in output_species.values()]
    with_habitat = sum(1 for text in summaries if HABITAT_PATTERN.search(text))
    with_diet = sum(1 for text in summaries if DIET_PATTERN.search(text))

    print('\n========== 統計 ==========')
    print(f'有維基簡介：{found} / {total}（{found / total:.1%}）')
    print(f'  來源：Wikidata {matched_by["wikidata"]}、中文名 {matched_by["nameZh"]}、學名 {matched_by["nameSci"]}')
    print(f'簡介提到棲地：{with_habitat} 種（佔全部物種 {with_habitat / total:.1%}）')
    print(f'簡介提到食性：{with_diet} 種（佔全部物種 {with_diet / total:.1%}）')
    print('\n依類群的覆蓋率：')
    groups = {}
    for species in species_list:
        stat = groups.setdefault(species['group'], [0, 0])
        stat[0] += 1
        stat[1] += str(species['id']) in output_species
    for group, (count, has) in sorted(groups.items(), key=lambda pair: -pair[1][0]):
        print(f'  {group:<16}{has:>5} / {count:<5}（{has / count:.0%}）')
    print(f'\n已輸出：{OUTPUT_PATH.relative_to(ROOT)}（{OUTPUT_PATH.stat().st_size / 1024:.0f} KB）')


if __name__ == '__main__':
    main()
