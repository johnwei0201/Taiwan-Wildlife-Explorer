"""
3-2 建立向量資料庫：把 3-1 切好的塊轉成向量，存進 Chroma（位置見 embedding.py 的 INDEX_DIR，可以重新產生，不上傳）

使用方式（在專案資料夾執行；請先執行 build_documents.py）：
  backend/.venv/Scripts/python backend/build_index.py

約 8,700 塊，一般筆電的 CPU 約需 5～15 分鐘（第一次執行還要下載模型）
轉好的向量會另存一份快取（backend/data/vectors.npy），塊的內容沒變時重建索引不必再轉一次
"""

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

from embedding import INDEX_DIR, MODEL_NAME, embed_passages, get_collection

DATA_DIR = Path(__file__).resolve().parent / 'data'
CHUNKS_PATH = DATA_DIR / 'chunks.jsonl'
VECTORS_PATH = DATA_DIR / 'vectors.npy'
VECTOR_KEYS_PATH = DATA_DIR / 'vector_keys.json'
BATCH = 500  # 每次寫進資料庫的筆數


def load_or_embed(chunks):
    """塊的 id 和內容都跟上次一樣 → 直接讀快取；否則重新轉向量並存檔"""
    keys = [f"{c['id']}|{hash_text(c['text'])}" for c in chunks]
    if VECTORS_PATH.exists() and VECTOR_KEYS_PATH.exists():
        if json.loads(VECTOR_KEYS_PATH.read_text(encoding='utf-8')) == keys:
            print('塊的內容沒變，使用向量快取')
            return np.load(VECTORS_PATH).tolist()

    started = time.time()
    vectors = embed_passages([c['text'] for c in chunks])
    print(f'轉向量完成：{time.time() - started:.0f} 秒，每個向量 {len(vectors[0])} 維')
    np.save(VECTORS_PATH, np.array(vectors, dtype=np.float32))
    VECTOR_KEYS_PATH.write_text(json.dumps(keys), encoding='utf-8')
    return vectors


def hash_text(text):
    import hashlib
    return hashlib.md5(text.encode('utf-8')).hexdigest()[:12]


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')

    chunks = [json.loads(line) for line in CHUNKS_PATH.read_text(encoding='utf-8').splitlines() if line]
    print(f'塊：{len(chunks)} 塊，模型：{MODEL_NAME}')
    vectors = load_or_embed(chunks)

    # 整個資料夾刪掉重建：避免上次中斷留下不完整的檔案
    shutil.rmtree(INDEX_DIR, ignore_errors=True)
    collection = get_collection(create=True)
    for start in range(0, len(chunks), BATCH):
        batch = chunks[start:start + BATCH]
        collection.add(
            ids=[c['id'] for c in batch],
            embeddings=vectors[start:start + BATCH],
            documents=[c['text'] for c in batch],
            metadatas=[{'docId': c['docId'], 'field': c['field']} for c in batch],
        )
    print(f'已寫入向量資料庫：{collection.count()} 筆（{INDEX_DIR}）')

    # 用「另一個新程序」打開資料庫查一次，確認存檔完整（不是只在這次的記憶體裡能用）
    check = subprocess.run(
        [sys.executable, '-X', 'utf8', '-c',
         'from embedding import get_collection;'
         f'r = get_collection().query(query_embeddings=[{vectors[0]}], n_results=1);'
         'print(r["ids"][0][0])'],
        cwd=Path(__file__).resolve().parent, capture_output=True, text=True, encoding='utf-8',
    )
    if check.returncode != 0 or check.stdout.strip() != chunks[0]['id']:
        sys.exit(f'驗證失敗：重新打開資料庫查不到資料\n{check.stderr[-500:]}')
    print('驗證通過：重新打開資料庫可以正常查詢')


if __name__ == '__main__':
    main()
