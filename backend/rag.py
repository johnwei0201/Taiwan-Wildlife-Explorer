"""
3-3 回答問題：混合式檢索（名稱查詢＋向量搜尋）→ Claude 根據找到的資料寫回答

流程：
  1. 名稱查詢：問題裡有物種名、俗名、名詞（例如「帝雉」「特有種」）→ 直接取那些文件，最準
  2. 類群篩選：問題裡有「鳥、蛙、蛇」等字 → 向量搜尋只在該類群裡找（「吃魚的鳥」的「魚」是食物，不算）
  3. 向量搜尋：問題裡沒有名稱時（例如「有哪些住在高山的鳥？」），找意思最接近的段落
  4. 生成：把找到的資料編號交給 Claude（Haiku 5.5），規定只能根據資料回答
  5. 備援：沒有 API 金鑰、額度用完或連線失敗時，改成「只列出找到的物種」，網站不會壞掉

回傳格式和前端 src/api/ask.js 一致：{ answer, sources: [物種 id], followUps: [延伸問題], mode }
"""

import json
import os
import re
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

from build_documents import normalize
from embedding import embed_query, get_collection

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR / 'data'
load_dotenv(BACKEND_DIR / '.env')  # 讀取 ANTHROPIC_API_KEY（.env 不上傳）

MODEL = 'claude-haiku-5-5'  # 最便宜的模型；一題約 0.001 美元
MAX_NAMED = 4               # 名稱查詢最多取幾個物種
MAX_SEARCHED = 5            # 向量搜尋最多取幾個物種
CANDIDATES = 40             # 向量搜尋先取幾塊，再依物種合併

INSECTS = ['lepidoptera', 'moth', 'odonata', 'coleoptera', 'hemiptera', 'orthoptera',
           'mantodea', 'phasmida', 'diptera', 'hymenoptera']

# 類群關鍵字（長的先比對，例如「山椒魚」是兩棲類，不要被「魚」搶走）
GROUP_KEYWORDS = {
    '山椒魚': ['amphibia'], '兩棲': ['amphibia'], '蛙': ['amphibia'], '蟾蜍': ['amphibia'],
    '鳥': ['aves'], '猛禽': ['aves'],
    '哺乳': ['mammalia'], '獸': ['mammalia'], '蝙蝠': ['mammalia'], '猴': ['mammalia'],
    '鼠': ['mammalia'], '鹿': ['mammalia'], '鯨': ['mammalia'], '海豚': ['mammalia'],
    '爬蟲': ['reptilia'], '蛇': ['reptilia'], '蜥蜴': ['reptilia'], '壁虎': ['reptilia'],
    '守宮': ['reptilia'], '龜': ['reptilia'], '鱉': ['reptilia'],
    '魚': ['fish'],
    '昆蟲': INSECTS,
    '蝴蝶': ['lepidoptera'], '蝶': ['lepidoptera'], '蛾': ['moth'],
    '蜻蜓': ['odonata'], '豆娘': ['odonata'],
    '甲蟲': ['coleoptera'], '金龜': ['coleoptera'], '獨角仙': ['coleoptera'], '鍬形蟲': ['coleoptera'],
    '天牛': ['coleoptera'], '瓢蟲': ['coleoptera'], '螢火蟲': ['coleoptera'],
    '蟬': ['hemiptera'], '椿象': ['hemiptera'],
    '蚱蜢': ['orthoptera'], '蟋蟀': ['orthoptera'], '螽斯': ['orthoptera'], '蝗': ['orthoptera'],
    '螳螂': ['mantodea'], '竹節蟲': ['phasmida'],
    '蒼蠅': ['diptera'], '蚊': ['diptera'], '蠓': ['diptera'],
    '蜂': ['hymenoptera'], '螞蟻': ['hymenoptera'], '蟻': ['hymenoptera'],
    '蜘蛛': ['araneae'], '蠍': ['arachnid_other'], '蟎': ['arachnid_other'], '蜱': ['arachnid_other'],
    '蜈蚣': ['myriapoda'], '馬陸': ['myriapoda'],
    '蝦': ['crustacea'], '蟹': ['crustacea'], '甲殼': ['crustacea'],
    '寵物': ['domestic'], '家養': ['domestic'], '家禽': ['domestic'], '家畜': ['domestic'],
}
FOOD_BEFORE = ('吃', '捕', '獵')  # 關鍵字前面有這些字 → 是食物，不是問的對象（「會吃魚的鳥」）

SYSTEM_PROMPT = """你是「發現台灣動物趣」網站的「AI 動物通」，用繁體中文回答關於臺灣動物的問題。

規則：
1. 只能根據使用者訊息裡的〈參考資料〉回答，不要用你自己的知識補充。參考資料沒有提到的事，直接說「本站資料沒有提到」。
2. 參考資料是用搜尋找出來的，可能有和問題無關的物種；只使用真正符合問題的資料，不相關的就忽略、也不要列進 sources。如果全部都不相關，就說本站資料找不到答案。
3. 用一般大眾（國小高年級也看得懂）的口吻，親切、簡潔，約 100～250 字。可以用條列。不要使用 Markdown 標題或粗體，不要在回答裡寫參考資料編號。
4. 常見月份是 iNaturalist 紀錄的統計，要說成「iNaturalist 上 4 月的紀錄最多」，不能說成「4 月數量最多」。
5. 一個俗名對應到多個物種時（例如「田雞仔」），說明它可能指哪幾種。
6. 和臺灣動物無關的問題（例如天氣、寫程式），禮貌地說明你只回答臺灣動物的問題；sources 留空，followUps 改成兩個入門問題，例如「臺灣藍鵲吃什麼？」「什麼是特有種？」。
7. sources：填你實際用到的參考資料編號（數字）。
8. followUps：提供 2 個延伸問題，要是本站資料可能回答得出來的（例如某物種的食性、棲地、是不是保育類、常在哪些月份出現），不超過 20 字。"""

ANSWER_SCHEMA = {
    'type': 'object',
    'properties': {
        'answer': {'type': 'string'},
        'sources': {'type': 'array', 'items': {'type': 'integer'}},
        'followUps': {'type': 'array', 'items': {'type': 'string'}},
    },
    'required': ['answer', 'sources', 'followUps'],
    'additionalProperties': False,
}


# ---------- 讀取 3-1 產生的資料（只讀一次） ----------

@lru_cache(maxsize=1)
def load_data():
    documents = json.loads((DATA_DIR / 'documents.json').read_text(encoding='utf-8'))
    name_index = json.loads((DATA_DIR / 'name_index.json').read_text(encoding='utf-8'))
    chunks_by_doc = {}
    for line in (DATA_DIR / 'chunks.jsonl').read_text(encoding='utf-8').splitlines():
        if line:
            chunk = json.loads(line)
            chunks_by_doc.setdefault(chunk['docId'], []).append(chunk)
    return documents, name_index, chunks_by_doc


# ---------- 1. 名稱查詢 ----------

def find_names(question):
    """找出問題裡的名稱：長的名稱優先（「臺灣藍鵲」優先於「藍鵲」），已經被比對到的字不再重複使用

    回傳 (文件 id 清單, 把名稱遮掉後的問題)；遮掉是為了避免「蛇鵰」的「蛇」被當成類群關鍵字
    """
    _, name_index, _ = load_data()
    text = normalize(question)
    used = [False] * len(text)
    found = []
    for length in range(min(len(text), 30), 1, -1):
        for start in range(len(text) - length + 1):
            key = text[start:start + length]
            if key not in name_index or any(used[start:start + length]):
                continue
            # 英文名要是完整的字（「cat」不能比對到「category」的一部分）
            if key.isascii() and (
                (start > 0 and text[start - 1].isalnum()) or
                (start + length < len(text) and text[start + length].isalnum())
            ):
                continue
            for i in range(start, start + length):
                used[i] = True
            found.append((start, name_index[key]))
    doc_ids = []
    for _, ids in sorted(found):  # 依名稱在問題裡出現的順序
        doc_ids.extend(i for i in ids if i not in doc_ids)
    masked = ''.join('□' if u else ch for ch, u in zip(text, used))
    return doc_ids, masked


# ---------- 2. 類群篩選 ----------

def find_groups(text):
    """問題裡提到哪些類群；「吃魚」「以魚為食」的魚是食物，不算"""
    groups = []
    for keyword in sorted(GROUP_KEYWORDS, key=len, reverse=True):
        for match in re.finditer(keyword, text):
            start, end = match.span()
            before, after = text[max(0, start - 2):start], text[end:end + 2]
            if not any(word in before for word in FOOD_BEFORE) and after != '為食':
                groups.extend(g for g in GROUP_KEYWORDS[keyword] if g not in groups)
            text = text[:start] + '□' * len(keyword) + text[end:]  # 遮掉，避免「山椒魚」又被「魚」比對
    return groups


# ---------- 3. 向量搜尋 ----------

def vector_search(question, groups):
    """依意思找最接近的塊，再依物種合併；每個物種取「最接近的那塊」＋「概要」"""
    where = {'group': {'$in': groups}} if groups else None
    results = get_collection().query(
        query_embeddings=[embed_query(question)], n_results=CANDIDATES, where=where,
    )
    _, _, chunks_by_doc = load_data()
    picked = {}
    for chunk_id, metadata in zip(results['ids'][0], results['metadatas'][0]):
        doc_id = metadata['docId']
        if doc_id in picked:
            continue
        doc_chunks = chunks_by_doc[doc_id]
        best = next(c for c in doc_chunks if c['id'] == chunk_id)
        overview = doc_chunks[0]
        picked[doc_id] = [overview] if best is overview else [overview, best]
        if len(picked) >= MAX_SEARCHED:
            break
    return picked


# ---------- 合併：混合式檢索 ----------

def retrieve(question):
    """回傳 {'references': [(文件, [塊])], 'method': 說明}"""
    documents, _, chunks_by_doc = load_data()
    named, masked = find_names(question)
    groups = find_groups(masked)

    named_species = [d for d in named if documents[d]['type'] == 'species'][:MAX_NAMED]
    glossary = [d for d in named if documents[d]['type'] == 'glossary']

    if named_species:
        # 問的是特定物種：取該物種的全部資料（概要、食性、棲地、習性、外觀）
        picked = {d: chunks_by_doc[d] for d in named_species}
        method = '名稱查詢'
    elif glossary:
        picked = {}
        method = '名詞查詢'
    else:
        picked = vector_search(question, groups)
        method = f"向量搜尋（類群：{'、'.join(groups)}）" if groups else '向量搜尋'
    for d in glossary:
        picked[d] = chunks_by_doc[d]

    return {'references': [(documents[d], chunks) for d, chunks in picked.items()], 'method': method}


# ---------- 4. 生成回答 ----------

def format_references(references):
    blocks = []
    for number, (document, chunks) in enumerate(references, start=1):
        body = '\n'.join(c['text'] for c in chunks)
        blocks.append(f'[{number}] {document["name"]}\n{body}')
    return '\n\n'.join(blocks)


def fallback_answer(references, reason):
    """備援模式：不用 AI，直接列出找到的物種"""
    species = [doc for doc, _ in references if doc['type'] == 'species']
    if not species:
        answer = f'{reason}，而且本站資料中沒有找到和這個問題相關的物種。'
    else:
        names = '、'.join(doc['name'] for doc in species)
        answer = f'{reason}，下方先列出本站資料中和問題最相關的物種：{names}。點卡片可以看詳細介紹。'
    return {
        'answer': answer,
        'sources': [doc['speciesId'] for doc in species],
        'followUps': [],
        'mode': 'fallback',
    }


def answer_question(question):
    retrieved = retrieve(question)
    references = retrieved['references']

    if not os.environ.get('ANTHROPIC_API_KEY'):
        return {**fallback_answer(references, 'AI 回答目前暫停服務'), 'method': retrieved['method']}

    import anthropic  # 有金鑰時才需要

    user_message = (
        f'〈參考資料〉\n{format_references(references) or "（沒有找到相關資料）"}\n〈/參考資料〉\n\n'
        f'〈問題〉\n{question}\n〈/問題〉'
    )
    try:
        response = anthropic.Anthropic().messages.create(
            model=MODEL,
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            messages=[{'role': 'user', 'content': user_message}],
            output_config={'effort': 'low', 'format': {'type': 'json_schema', 'schema': ANSWER_SCHEMA}},
        )
    except anthropic.APIError as error:
        # 額度用完、金鑰失效、連線失敗…都改用備援，網站不會壞掉
        print(f'Claude API 錯誤：{type(error).__name__}: {error}')
        return {**fallback_answer(references, 'AI 回答暫時無法使用'), 'method': retrieved['method']}

    if response.stop_reason != 'end_turn':
        print(f'Claude 沒有正常結束：{response.stop_reason}')
        return {**fallback_answer(references, 'AI 回答暫時無法使用'), 'method': retrieved['method']}

    result = json.loads(next(b.text for b in response.content if b.type == 'text'))
    # 參考資料編號 → 物種 id（名詞解釋沒有物種卡片，不列）
    source_ids = []
    for number in result['sources']:
        if 1 <= number <= len(references):
            document = references[number - 1][0]
            if document['type'] == 'species' and document['speciesId'] not in source_ids:
                source_ids.append(document['speciesId'])
    return {
        'answer': result['answer'],
        'sources': source_ids,
        'followUps': result['followUps'][:2],
        'mode': 'ai',
        'method': retrieved['method'],
        'usage': {'input': response.usage.input_tokens, 'output': response.usage.output_tokens},
    }
