"""
3-2 建立向量：把 3-1 切好的塊轉成向量，存成 backend/data/vectors.npy；再用 backend/db/import_vectors.py 匯入 PostgreSQL（pgvector），線上 API 從資料庫搜尋

使用方式（在專案資料夾執行；請先執行 build_documents.py；需要安裝 backend/requirements.txt）：
  backend/.venv/Scripts/python backend/build_index.py

全部約 8,700 塊，一般筆電的 CPU 約需 10 分鐘（第一次執行還要下載模型）
有快取：之後重建只重新轉「新增或改過」的塊，通常幾秒到一分鐘
vectors.npy 的第 i 列對應 chunks.jsonl 的第 i 塊
"""

import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np

from embedding import MODEL_NAME, embed_passages

DATA_DIR = Path(__file__).resolve().parent / 'data'
CHUNKS_PATH = DATA_DIR / 'chunks.jsonl'
VECTORS_PATH = DATA_DIR / 'vectors.npy'
VECTOR_KEYS_PATH = DATA_DIR / 'vector_keys.json'


def hash_text(text):
    return hashlib.md5(text.encode('utf-8')).hexdigest()[:12]


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')

    chunks = [json.loads(line) for line in CHUNKS_PATH.read_text(encoding='utf-8').splitlines() if line]
    print(f'塊：{len(chunks)} 塊，模型：{MODEL_NAME}')

    # 逐塊比對快取：id 和內容都跟上次一樣的塊直接沿用向量，只有新增或改過的塊才重新轉
    keys = [f"{c['id']}|{hash_text(c['text'])}" for c in chunks]
    cached = {}
    if VECTORS_PATH.exists() and VECTOR_KEYS_PATH.exists():
        old_keys = json.loads(VECTOR_KEYS_PATH.read_text(encoding='utf-8'))
        cached = dict(zip(old_keys, np.load(VECTORS_PATH)))

    todo = [i for i, key in enumerate(keys) if key not in cached]
    print(f'向量快取：沿用 {len(keys) - len(todo)} 塊，需要重新轉 {len(todo)} 塊')
    if todo:
        started = time.time()
        new_vectors = embed_passages([chunks[i]['text'] for i in todo], show_progress=len(todo) > 100)
        cached.update({keys[i]: np.array(vector, dtype=np.float32) for i, vector in zip(todo, new_vectors)})
        print(f'轉向量完成：{time.time() - started:.0f} 秒，每個向量 {len(new_vectors[0])} 維')

    vectors = np.stack([cached[key] for key in keys]).astype(np.float32)
    np.save(VECTORS_PATH, vectors)
    VECTOR_KEYS_PATH.write_text(json.dumps(keys), encoding='utf-8')
    print(f'已輸出：{VECTORS_PATH.relative_to(DATA_DIR.parent.parent)}（{vectors.shape[0]} × {vectors.shape[1]}）')


if __name__ == '__main__':
    main()
