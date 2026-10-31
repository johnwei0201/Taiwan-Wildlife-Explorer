"""
把 RAG 的文字塊和向量（backend/data/chunks.jsonl、vectors.npy）匯入 PostgreSQL 的 rag_chunks（pgvector）

使用方式（在專案資料夾執行；需要 backend/.env 裡的 DATABASE_URL）：
  backend/.venv/Scripts/python backend/db/import_species.py   → 先匯入物種（rag_chunks 的 species_id 參照 species）
  backend/.venv/Scripts/python backend/db/import_vectors.py

資料更新的流程：build_documents.py → build_index.py → import_vectors.py
整個匯入在一個交易裡：先清空再用 COPY 寫入，中途出錯就保留原本的資料
"""

import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / 'backend' / 'data'
SCHEMA_FILE = Path(__file__).resolve().parent / 'schema.sql'


def vector_text(vector):
    """pgvector 的文字格式：[0.1,0.2,...]"""
    return '[' + ','.join(f'{x:.7g}' for x in vector) + ']'


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    load_dotenv(ROOT / 'backend' / '.env')
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        sys.exit('找不到 DATABASE_URL：請在 backend/.env 加上資料庫的連線字串')

    chunks = [json.loads(line) for line in (DATA_DIR / 'chunks.jsonl').read_text(encoding='utf-8').splitlines() if line]
    vectors = np.load(DATA_DIR / 'vectors.npy')
    if len(chunks) != len(vectors):
        sys.exit('vectors.npy 和 chunks.jsonl 的數量不同，請重新執行 build_index.py')
    started = time.time()

    rows, positions = [], {}
    for chunk, vector in zip(chunks, vectors):
        doc_id = chunk['docId']
        positions[doc_id] = positions.get(doc_id, 0) + 1  # chunks.jsonl 裡同一份文件的塊是連續的，概要排第一
        species_id = int(doc_id.split(':')[1]) if doc_id.startswith('species:') else None
        rows.append((
            chunk['id'], doc_id, species_id, chunk['group'], chunk['field'], positions[doc_id],
            chunk['text'], vector_text(vector),
        ))

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.execute(SCHEMA_FILE.read_text(encoding='utf-8'))
        cur.execute('TRUNCATE rag_chunks')
        with cur.copy(
            'COPY rag_chunks (id, doc_id, species_id, group_code, field, position, content, embedding) FROM STDIN'
        ) as copy:
            for row in rows:
                copy.write_row(row)
        cur.execute('ANALYZE rag_chunks')  # 更新統計資料，讓查詢規劃器知道表有多大

    print(f'匯入完成（{time.time() - started:.1f} 秒）：rag_chunks {len(rows)} 筆')


if __name__ == '__main__':
    main()
