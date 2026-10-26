"""
物種生態資料腳本（階段一 C）：產生 public/data/species-ecology.json

階段一 B 的維基簡介只有條目開頭的「導言」，很少寫到食性（只有 4.2%）。這支腳本改抓條目「全文」，
依段落標題整理出：
  diet       食性（「覓食」「食性」等段落；沒有獨立段落就從全文找提到食性的句子）
  habitat    棲地與分布
  behavior   習性、行為
  appearance 外觀特徵（比較兩種動物時用得到）
  aliases    俗名（導言裡的「又稱、又名、俗稱」；維基台灣用語標題和網站中文名不同時，也當作俗名）

只處理階段一 B 已經找到維基條目的物種（public/data/species-summaries.json，約 2,000 種）

全文用維基百科的 action API（prop=extracts、explaintext），指定 variant=zh-tw → 簡體條目也會轉成台灣正體中文

使用方式（在專案資料夾執行；請先執行 scripts/fetch-summaries.py）：
  python scripts/fetch-ecology.py

每次請求都會存一份快取（scripts/.cache/ecology/），中斷後重新執行，已經查過的會直接跳過
約 2,000 次請求，每次間隔 0.5 秒，約需 25～40 分鐘
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

WIKI_ACTION_API = 'https://zh.wikipedia.org/w/api.php'
# Wikimedia 要求 User-Agent 附上聯絡方式（網址或信箱），沒有的話很容易被限速（HTTP 429）
HEADERS = {'User-Agent': 'TaiwanWildlifeExplorer/0.1 (https://taiwan-wildlife-explorer.vercel.app)'}
REQUEST_DELAY_SECONDS = 0.5

ROOT = Path(__file__).resolve().parent.parent
SPECIES_LIST_PATH = ROOT / 'public' / 'data' / 'species-list.json'
SUMMARIES_PATH = ROOT / 'public' / 'data' / 'species-summaries.json'
OUTPUT_PATH = ROOT / 'public' / 'data' / 'species-ecology.json'
CACHE_DIR = ROOT / 'scripts' / '.cache' / 'ecology'

# 每一類資料最多保留的字數：夠 RAG 回答問題，又不會讓檔案太大
MAX_CHARS = {'diet': 400, 'habitat': 400, 'behavior': 400, 'appearance': 300}

# 依段落標題分類（由上往下比對，第一個符合的就採用）
SECTION_RULES = [
    ('diet', re.compile(r'食|覓食|捕食|獵物')),
    ('habitat', re.compile(r'棲|分布|分佈|生境|地理|範圍')),
    ('behavior', re.compile(r'習性|行為|生態|生活|繁殖')),
    ('appearance', re.compile(r'形態|形態|外觀|外形|特徵|描述|鑑別|辨識')),
]
# 這些段落和回答問題無關，直接略過
SKIP_SECTION = re.compile(r'參考|註釋|注釋|外部連結|延伸閱讀|相關條目|參見|圖庫|畫廊|文獻|資料來源|亞種|分類')

# 沒有獨立段落時，從全文找「提到食性／棲地」的句子
#   不用單獨的「吃」：俗名裡常有（例如大卷尾的俗名「吃杯茶」），會抓錯句子
DIET_PATTERN = re.compile(r'以.{0,20}為食|為食|捕食|食物|主食|食性|取食|覓食|吸食|草食|肉食|雜食|食蟲|獵物|寄主|食草')
HABITAT_PATTERN = re.compile(r'棲息|棲地|生活於|生活在|分布於|分佈於|出沒|海拔|森林|溪流|濕地|草原|海域|洞穴|潮間帶')

# 俗名：導言裡「又稱○○、○○」這類寫法
ALIAS_PATTERN = re.compile(r'(?:又稱|又名|俗稱|別名|別稱|簡稱|舊稱|古稱|俗名)(?:為|作|是)?[：:]?(.+?)(?:[，。；]|$)')
CJK_NAME = re.compile(r'^[一-鿿]{2,8}$')


# ---------- 小工具 ----------

def fetch_full_text(title, retries=3):
    """抓維基條目全文（純文字、台灣用語）；有快取就用快取。查不到回傳 None"""
    cache_file = CACHE_DIR / (hashlib.sha1(title.encode()).hexdigest() + '.json')
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding='utf-8'))

    params = {
        'action': 'query', 'prop': 'extracts', 'explaintext': 1, 'exsectionformat': 'wiki',
        'titles': title, 'redirects': 1, 'variant': 'zh-tw', 'format': 'json', 'formatversion': 2,
    }
    url = f'{WIKI_ACTION_API}?{urllib.parse.urlencode(params)}'
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
                page = json.load(response)['query']['pages'][0]
            break
        except (urllib.error.URLError, TimeoutError) as error:
            if attempt >= retries:
                # 單一條目一直出錯：跳過這一筆，不存快取，下次執行時會再試一次
                print(f'  ⚠️ {error} 重試 {retries} 次仍失敗，先跳過：{title}')
                return None
            wait = 5 * 2 ** attempt
            print(f'  ⚠️ {error}，{wait} 秒後重試…')
            time.sleep(wait)

    result = None if page.get('missing') else {'title': page['title'], 'text': page.get('extract', '')}
    time.sleep(REQUEST_DELAY_SECONDS)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
    return result


def split_sections(text):
    """全文 → (導言, [(段落標題, 所屬大段落標題, 內容)])
    小段落（=== 標題 ===）也獨立列出，例如「行為生物學」底下的「覓食」，分類時才找得到食性"""
    parts = re.split(r'\n(={2,})\s*(.+?)\s*\1\n', '\n' + text)
    lead = parts[0].strip()
    sections = []
    parent = ''
    for index in range(1, len(parts) - 2, 3):
        level, heading, body = len(parts[index]), parts[index + 1], parts[index + 2].strip()
        if level == 2:
            parent = heading
        sections.append((heading, parent if level > 2 else '', body))
    return lead, sections


def clean(text, limit):
    """整理文字：去掉多餘空白，太長就截斷在句號"""
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    period = cut.rfind('。')
    return cut[:period + 1] if period > limit * 0.5 else cut + '…'


def sentences_matching(text, pattern, limit):
    """從全文找出符合 pattern 的句子（最多湊到 limit 個字）"""
    picked = []
    for sentence in re.split(r'(?<=[。！？])', re.sub(r'\s+', ' ', text)):
        if pattern.search(sentence) and sentence.strip() not in picked:
            picked.append(sentence.strip())
        if sum(len(s) for s in picked) >= limit:
            break
    return clean(''.join(picked), limit) if picked else None


def same_name(a, b):
    """「臺」和「台」視為同一個字（例如「台灣藍鵲」和「臺灣藍鵲」是同一個名字）"""
    return a.replace('臺', '台') == b.replace('臺', '台')


def extract_aliases(lead, display_title, name_zh):
    """導言裡的「又稱、又名」→ 俗名清單；維基的台灣用語標題和網站中文名不同時也算俗名
    display_title 用階段一 B 存下的標題（已轉成台灣用語；全文 API 回傳的標題不會轉換）"""
    aliases = []

    def add(name, first=False):
        if CJK_NAME.match(name) and not same_name(name, name_zh) and not any(same_name(name, a) for a in aliases):
            aliases.insert(0, name) if first else aliases.append(name)

    lead = re.sub(r'[（(][^）)]*[）)]', '', lead)  # 括號裡多半是學名、英文、台羅拼音，先拿掉
    for match in ALIAS_PATTERN.finditer(lead):
        for token in re.split(r'[、/／]|或|和|及|與', match.group(1)):
            add(token.strip(' 「」『』"\'').removesuffix('等'))
    add(display_title, first=True)
    return aliases


def parse_ecology(page, name_zh, display_title):
    lead, sections = split_sections(page['text'])
    result = {}
    body_text = []  # 用來找句子的內文（略過參考資料等無關段落）
    for heading, parent, body in sections:
        if SKIP_SECTION.search(heading) or SKIP_SECTION.search(parent) or not body:
            continue
        body_text.append(body)
        # 先看自己的標題，對不上再看所屬大段落的標題（例如「行為生物學」底下沒有特別名稱的小段落）
        for title in (heading, parent):
            field = next((f for f, pattern in SECTION_RULES if title and pattern.search(title)), None)
            if field:
                result[field] = f'{result.get(field, "")} {body}'.strip()
                break

    for field, limit in MAX_CHARS.items():
        if field in result:
            result[field] = clean(result[field], limit)

    # 沒有獨立的食性、棲地段落：從內文找提到的句子，內文找不到才找導言（導言常有俗名，容易誤判）
    for field, pattern in (('diet', DIET_PATTERN), ('habitat', HABITAT_PATTERN)):
        if field not in result:
            found = sentences_matching('\n'.join(body_text), pattern, MAX_CHARS[field]) or \
                sentences_matching(lead, pattern, MAX_CHARS[field])
            if found:
                result[field] = found

    aliases = extract_aliases(lead, display_title, name_zh)
    if aliases:
        result['aliases'] = aliases
    return result


# ---------- 主程式 ----------

def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')

    species_list = json.loads(SPECIES_LIST_PATH.read_text(encoding='utf-8'))
    summaries = json.loads(SUMMARIES_PATH.read_text(encoding='utf-8'))['species']
    names = {str(s['id']): s.get('nameZh') or '' for s in species_list}
    print(f'有維基條目的物種：{len(summaries)} 種（每 200 種回報一次進度）')

    output_species = {}
    for index, (species_id, summary) in enumerate(summaries.items(), start=1):
        # 用階段一 B 存下的條目網址取出正式條目名稱（網址最後一段）
        title = urllib.parse.unquote(summary['url'].rsplit('/', 1)[-1])
        page = fetch_full_text(title)
        if page and page['text']:
            ecology = parse_ecology(page, names.get(species_id, ''), summary['title'])
            if ecology:
                output_species[species_id] = ecology
        if index % 200 == 0 or index == len(summaries):
            print(f'  {index} / {len(summaries)}')

    output = {
        'updatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'source': '中文維基百科全文（CC BY-SA 4.0），台灣正體中文',
        'species': output_species,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

    # 統計報告：和階段一 B（只有導言）比較
    total = len(species_list)
    def count(field):
        return sum(1 for item in output_species.values() if field in item)
    print('\n========== 統計（佔全部 3,560 種） ==========')
    for field, label in [('diet', '食性'), ('habitat', '棲地與分布'), ('behavior', '習性'), ('appearance', '外觀'), ('aliases', '俗名')]:
        print(f'{label}：{count(field)} 種（{count(field) / total:.1%}）')
    alias_total = sum(len(item.get('aliases', [])) for item in output_species.values())
    print(f'俗名共 {alias_total} 個')
    print(f'\n已輸出：{OUTPUT_PATH.relative_to(ROOT)}（{OUTPUT_PATH.stat().st_size / 1024:.0f} KB）')


if __name__ == '__main__':
    main()
