"""
3-2 測試檢索：輸入問題，看向量搜尋找出來的物種對不對（還沒有用到 Claude，不需要 API 金鑰）

使用方式（在專案資料夾執行；請先執行 build_index.py）：
  backend/.venv/Scripts/python backend/search_index.py              → 跑內建的測試問題
  backend/.venv/Scripts/python backend/search_index.py 有哪些住在高山的鳥  → 測試自己的問題

結果依「物種」整理：同一個物種有好幾塊符合時只列一次，顯示最相近的那一塊
相似度（1 - 餘弦距離）越接近 1 越像
"""

import json
import sys
from pathlib import Path

from embedding import embed_query, get_collection

DOCUMENTS_PATH = Path(__file__).resolve().parent / 'data' / 'documents.json'
FIELD_LABELS = {'overview': '概要', 'diet': '食性', 'habitat': '棲地', 'behavior': '習性', 'appearance': '外觀', 'glossary': '名詞'}

TEST_QUESTIONS = [
    '臺灣藍鵲吃什麼？',
    '有哪些住在高山的鳥？',
    '會吃昆蟲的青蛙有哪些？',
    '什麼是特有種？',
    '晚上活動、會吃魚的鳥',
    '有毒的蛇',
]


def search(question, top_species=5, candidates=30):
    """向量搜尋：先找出最相近的 candidates 塊，再依物種合併，回傳前 top_species 種"""
    results = get_collection().query(query_embeddings=[embed_query(question)], n_results=candidates)
    seen = {}
    for chunk_id, metadata, distance, text in zip(
        results['ids'][0], results['metadatas'][0], results['distances'][0], results['documents'][0]
    ):
        doc_id = metadata['docId']
        if doc_id not in seen:
            seen[doc_id] = {'docId': doc_id, 'field': metadata['field'], 'score': 1 - distance, 'text': text}
        if len(seen) >= top_species:
            break
    return list(seen.values())


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    documents = json.loads(DOCUMENTS_PATH.read_text(encoding='utf-8'))

    questions = [' '.join(sys.argv[1:])] if len(sys.argv) > 1 else TEST_QUESTIONS
    for question in questions:
        print(f'\n■ {question}')
        for rank, hit in enumerate(search(question), start=1):
            name = documents[hit['docId']]['name']
            snippet = hit['text'].replace('\n', ' ')[:50]
            print(f"  {rank}. {name}（{FIELD_LABELS.get(hit['field'], hit['field'])}，相似度 {hit['score']:.3f}）{snippet}…")


if __name__ == '__main__':
    main()
