"""
3-1 資料轉文件：把網站的物種資料整理成 RAG 用的文件

輸入（階段一產生的資料，都在 public/data/）：
  species-list.json       物種基本資料（名稱、分類、特有種、保育等級…）
  species-details.json    常見月份、出現縣市
  species-summaries.json  維基導言
  species-ecology.json    食性、棲地、習性、外觀、俗名

輸出（backend/data/，線上 API 會讀取，所以要上傳）：
  documents.json   每個物種的基本資訊（名稱、俗名、類群、物種 id）；另有幾份名詞解釋
  chunks.jsonl     切好的「塊」，回答時交給 Claude 看；3-2 也用來轉向量
  name_index.json  名稱索引（中文名、俗名、學名、英文名 → 文件 id），混合式檢索的「名稱直接查詢」用

為什麼要切塊（chunking）：
  轉向量的模型一次最多讀約 500 字，整份文件塞進去，後面的內容會被截掉；
  切成「概要、食性、棲地、習性、外觀」各一塊，問「吃什麼」時，向量搜尋能直接對到「食性」那一塊。
  每一塊開頭都帶物種名稱（例如「臺灣藍鵲的食性：…」），向量才知道這段在講哪種動物。

使用方式（在專案資料夾執行）：
  backend/.venv/Scripts/python backend/build_documents.py
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_IN = ROOT / 'public' / 'data'
DATA_OUT = Path(__file__).resolve().parent / 'data'

# ---------- 代碼 → 中文說明（和網站 src/constants/labels.js 的說法一致） ----------

GROUP_LABELS = {
    'aves': '鳥類', 'mammalia': '哺乳類', 'reptilia': '爬蟲類', 'amphibia': '兩棲類', 'fish': '魚類',
    'lepidoptera': '昆蟲類（蝴蝶）', 'moth': '昆蟲類（蛾）', 'odonata': '昆蟲類（蜻蜓、豆娘）',
    'coleoptera': '昆蟲類（甲蟲）', 'hemiptera': '昆蟲類（蟬、椿象）', 'orthoptera': '昆蟲類（蚱蜢、蟋蟀）',
    'mantodea': '昆蟲類（螳螂）', 'phasmida': '昆蟲類（竹節蟲）', 'diptera': '昆蟲類（蒼蠅、蚊子）',
    'hymenoptera': '昆蟲類（蜂、螞蟻）', 'araneae': '蛛形類（蜘蛛）', 'arachnid_other': '蛛形類（蠍子、盲蛛、蟎等）',
    'myriapoda': '多足類（蜈蚣、馬陸）', 'crustacea': '甲殼類', 'domestic': '家養動物',
}
PROTECTED_LABELS = {'I': '第 I 級保育類（瀕臨絕種）', 'II': '第 II 級保育類（珍貴稀有）', 'III': '第 III 級保育類（其他應予保育）'}
REDLIST_LABELS = {
    'NEX': '國家滅絕', 'NEW': '野外滅絕', 'NRE': '區域滅絕', 'RE': '區域滅絕', 'NCR': '國家極危', 'NEN': '國家瀕危',
    'NVU': '國家易危', 'NNT': '國家接近受脅', 'NLC': '暫無危機', 'NDD': '資料缺乏', 'DD': '資料缺乏',
    'NA': '不適用（外來種或偶見的物種）', 'NE': '尚未評估',
}
ALIEN_LABELS = {
    'native': '原生種', 'naturalized': '外來種（歸化種）', 'invasive': '外來種（入侵種）', 'cultured': '外來種（栽培豢養）',
}
FIELD_LABELS = {'diet': '食性', 'habitat': '棲地與分布', 'behavior': '習性', 'appearance': '外觀'}

# 人工補充的俗名：常用說法，但維基導言沒寫到（鍵是本站的中文名）
EXTRA_ALIASES = {
    '亞洲黑熊': ['臺灣黑熊'],  # 臺灣黑熊是亞洲黑熊的亞種，本站以物種收錄
    '大冠鷲': ['蛇鵰'],
    '家犬': ['狗狗', '小狗'],
    '家貓': ['貓咪', '小貓'],
}

# 名詞解釋：問「什麼是特有種？」這類問題時用（內容和網站上的說明一致）
GLOSSARY = [
    ('endemic', '特有種', '臺灣特有種：只分布在臺灣（含離島），在世界其他地方的野外都找不到的物種。臺灣是一座島嶼，生物長期和大陸隔離，演化出許多獨一無二的特有種。'),
    ('protected', '保育類', '保育類：依《野生動物保育法》公告需要特別保護的野生動物，未經許可不得騷擾、虐待、獵捕、宰殺或買賣。分成三個等級：第 I 級瀕臨絕種、第 II 級珍貴稀有、第 III 級其他應予保育。'),
    ('redlist', '臺灣紅皮書', '臺灣紅皮書：評估物種在臺灣滅絕風險的名錄。由低到高為暫無危機（NLC）、接近受脅（NNT）、易危（NVU）、瀕危（NEN）、極危（NCR）；另有資料缺乏（NDD）、區域滅絕（NRE）、野外滅絕（NEW）、國家滅絕（NEX）。'),
    ('alien', '外來種', '外來種：原本不在臺灣，因為人類有意或無意引進而來到臺灣的物種。依對環境的影響分成：入侵種（在野外大量繁殖，危害生態、農業或人類生活，例如沙氏變色蜥、斑腿樹蛙）、歸化種（在野外自己繁殖、穩定生存下來）、栽培豢養（寵物或家禽家畜逃逸或被棄養，還沒有在野外穩定繁殖）。請不要任意棄養或放生寵物。'),
    ('domestic', '家養動物', '家養動物：由人類長期飼養、馴化的動物，例如貓、狗、豬、牛、羊、雞、鴨、鵝。牠們不是野生動物，本站收錄在「家養動物」分頁。'),
    ('research-grade', '研究級紀錄', '研究級紀錄：iNaturalist 上的觀察紀錄，經過其他使用者確認物種，並有日期、地點和照片。本站的常見月份、出現縣市是依研究級紀錄統計，反映的是「大家什麼時候、在哪裡拍到」，不完全等於動物實際的數量。'),
]


def normalize(text):
    """名稱比對用：英文小寫、「臺」和「台」視為同一個字、去掉空白（和網站搜尋的規則一致）"""
    return re.sub(r'\s+', '', (text or '').lower().replace('臺', '台'))


def clean_zh(name):
    """中文名後面的括號別名拿掉，例如「白斑蛾蚋 (大蛾蚋)」→「白斑蛾蚋」"""
    return re.sub(r'\s*[（(].*$', '', name or '').strip()


def months_text(months):
    total = sum(months)
    if total == 0:
        return None
    top = sorted(range(12), key=lambda m: months[m], reverse=True)[:3]
    top_text = '、'.join(f'{m + 1} 月（{months[m]} 筆）' for m in top if months[m] > 0)
    return f'iNaturalist 研究級紀錄共 {total} 筆，紀錄最多的月份：{top_text}'


def counties_text(counties):
    if not counties:
        return None
    names = list(counties)
    top = '、'.join(f'{name}（{counties[name]} 筆）' for name in names[:6])
    more = f'等 {len(names)} 個縣市' if len(names) > 6 else f'共 {len(names)} 個縣市'
    return f'{top}，{more}'


def build_species(species, details, summary, ecology):
    """一個物種 → (完整文件, [塊])"""
    name = clean_zh(species['nameZh']) or species['nameSci']
    sci = species['nameSci']
    aliases = [*(species.get('aliases') or []), *(ecology.get('aliases') or []), *EXTRA_ALIASES.get(name, [])]
    aliases = [a for a in aliases if a != name]
    aliases = list(dict.fromkeys(aliases))  # 去掉重複、保留順序

    taxonomy = ' > '.join(
        (rank.get('nameZh') or rank.get('nameSci'))
        for rank in (species.get('class'), species.get('order'), species.get('family'), species.get('genus'))
        if rank
    )
    status = [ALIEN_LABELS.get(species.get('alienType'), '')]
    if species.get('endemic'):
        status.insert(0, '臺灣特有種')
    if species.get('protectedLevel'):
        status.append(PROTECTED_LABELS.get(species['protectedLevel'], ''))
    if species.get('redlist'):
        status.append(f"臺灣紅皮書：{REDLIST_LABELS.get(species['redlist'], species['redlist'])}")
    status = [s for s in status if s]

    header = f"物種：{name}（學名 {sci}{'；英文 ' + species['nameEn'] if species.get('nameEn') else ''}）"
    overview_lines = [
        header,
        f"俗名：{'、'.join(aliases)}" if aliases else None,
        f"類群：{GROUP_LABELS.get(species['group'], species['group'])}",
        f'分類：{taxonomy}' if taxonomy else None,
        f"身分：{'；'.join(status)}" if status else None,
        f"外型：{species['shape']}" if species.get('shape') and species['shape'] != '其他' else None,
        f"顏色：{'、'.join(species['colors'])}" if species.get('colors') else None,
        f"常見月份：{months_text(details['months'])}" if details and months_text(details['months']) else None,
        f"出現縣市：{counties_text(details['counties'])}" if details and counties_text(details['counties']) else None,
        f"簡介：{summary['summary']}" if summary else None,
    ]
    overview = '\n'.join(line for line in overview_lines if line)

    fields = {field: ecology[field] for field in FIELD_LABELS if ecology.get(field)}

    doc_id = f"species:{species['id']}"
    document = {
        'id': doc_id,
        'type': 'species',
        'speciesId': species['id'],
        'name': name,
        'nameSci': sci,
        'aliases': aliases,
        'group': species['group'],
        'url': summary['url'] if summary else None,
    }
    group = species['group']
    chunks = [{'id': f'{doc_id}#overview', 'docId': doc_id, 'group': group, 'field': 'overview', 'text': overview}]
    for field, text in fields.items():
        chunks.append({
            'id': f'{doc_id}#{field}',
            'docId': doc_id,
            'group': group,
            'field': field,
            'text': f'{name}（{sci}）的{FIELD_LABELS[field]}：{text}',
        })
    return document, chunks


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')

    load = lambda name: json.loads((DATA_IN / name).read_text(encoding='utf-8'))
    species_list = load('species-list.json')
    details = load('species-details.json')['species']
    summaries = load('species-summaries.json')['species']
    ecology = load('species-ecology.json')['species']

    documents, chunks = [], []
    name_index = {}

    def index_name(name, doc_id):
        key = normalize(name)
        if len(key) >= 2:
            ids = name_index.setdefault(key, [])
            if doc_id not in ids:
                ids.append(doc_id)

    for species in species_list:
        sid = str(species['id'])
        document, species_chunks = build_species(species, details.get(sid), summaries.get(sid), ecology.get(sid, {}))
        documents.append(document)
        chunks.extend(species_chunks)
        for name in [document['name'], species['nameSci'], species.get('nameEn'), *document['aliases']]:
            if name:
                index_name(name, document['id'])

    for key, term, text in GLOSSARY:
        doc_id = f'glossary:{key}'
        documents.append({'id': doc_id, 'type': 'glossary', 'name': term})
        chunks.append({'id': f'{doc_id}#overview', 'docId': doc_id, 'group': 'glossary', 'field': 'glossary', 'text': text})
        index_name(term, doc_id)

    DATA_OUT.mkdir(exist_ok=True)
    (DATA_OUT / 'documents.json').write_text(
        json.dumps({d['id']: d for d in documents}, ensure_ascii=False), encoding='utf-8')
    (DATA_OUT / 'chunks.jsonl').write_text(
        '\n'.join(json.dumps(c, ensure_ascii=False) for c in chunks) + '\n', encoding='utf-8')
    (DATA_OUT / 'name_index.json').write_text(json.dumps(name_index, ensure_ascii=False), encoding='utf-8')

    # 統計報告
    lengths = sorted(len(c['text']) for c in chunks)
    ambiguous = {k: v for k, v in name_index.items() if len(v) > 1}
    by_field = {}
    for chunk in chunks:
        by_field[chunk['field']] = by_field.get(chunk['field'], 0) + 1
    print(f'文件：{len(documents)} 份（物種 {len(species_list)}、名詞解釋 {len(GLOSSARY)}）')
    print(f"塊：{len(chunks)} 塊（{'、'.join(f'{FIELD_LABELS.get(k, k)} {v}' for k, v in by_field.items())}）")
    print(f'塊的長度：中位數 {lengths[len(lengths) // 2]} 字，最長 {lengths[-1]} 字')
    print(f'名稱索引：{len(name_index)} 個名稱，其中 {len(ambiguous)} 個對應到多份文件（例如 {"、".join(list(ambiguous)[:5])}）')
    print(f'已輸出：{DATA_OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
