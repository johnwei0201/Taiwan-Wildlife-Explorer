"""
驗證 pgvector 版的檢索結果和原本的 numpy 版是否相同（只做檢索、不呼叫 Claude，不花錢）

numpy 版：讀 backend/data/chunks.jsonl、vectors.npy，在記憶體裡算相似度（第 3 步之前的做法）
pgvector 版：rag.retrieve()，向量搜尋和取資料都在 PostgreSQL

使用方式（在專案資料夾執行；需要 backend/.env 裡的 DATABASE_URL）：
  backend/.venv/Scripts/python backend/verify_pgvector.py
"""

import json
import re
import sys
import time
from pathlib import Path

import numpy as np

import rag
from ask import TEST_QUESTIONS
from query_encoder import embed_query

DATA_DIR = Path(__file__).resolve().parent / 'data'
QUESTIONS_FILE = Path(__file__).resolve().parent.parent / 'src' / 'constants' / 'askQuestions.js'


def load_numpy_index():
    chunks = [json.loads(line) for line in (DATA_DIR / 'chunks.jsonl').read_text(encoding='utf-8').splitlines() if line]
    vectors = np.load(DATA_DIR / 'vectors.npy')
    chunks_by_doc = {}
    for chunk in chunks:
        chunks_by_doc.setdefault(chunk['docId'], []).append(chunk)
    return chunks, vectors, np.array([c['group'] for c in chunks]), chunks_by_doc


def numpy_retrieve(question, index):
    """第 3 步之前 rag.retrieve 的做法，只回傳 [(文件 id, [塊 id])]"""
    chunks, vectors, chunk_groups, chunks_by_doc = index
    documents, _ = rag.load_data()
    named, masked = rag.find_names(question)
    groups = rag.find_groups(masked)
    named_species = [d for d in named if documents[d]['type'] == 'species'][:rag.MAX_NAMED]
    glossary = [d for d in named if documents[d]['type'] == 'glossary']

    if named_species:
        picked = {d: [c['id'] for c in chunks_by_doc[d]] for d in named_species}
    elif glossary:
        picked = {}
    else:
        scores = vectors @ embed_query(question)
        if groups:
            scores = np.where(np.isin(chunk_groups, groups), scores, -np.inf)
        picked = {}
        for i in np.argsort(-scores)[:rag.CANDIDATES]:
            if scores[i] == -np.inf:
                break
            doc_id = chunks[i]['docId']
            if doc_id in picked:
                continue
            overview = chunks_by_doc[doc_id][0]['id']
            picked[doc_id] = [overview] if chunks[i]['id'] == overview else [overview, chunks[i]['id']]
            if len(picked) >= rag.MAX_SEARCHED:
                break
    for d in glossary:
        picked[d] = [c['id'] for c in chunks_by_doc[d]]
    return list(picked.items())


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    source = '\n'.join(l for l in QUESTIONS_FILE.read_text(encoding='utf-8').splitlines() if not l.strip().startswith('//'))
    questions = list(dict.fromkeys(TEST_QUESTIONS + re.findall(r"'([^']+)'", source)))
    index = load_numpy_index()

    same, elapsed = 0, []
    for question in questions:
        expected = numpy_retrieve(question, index)
        started = time.time()
        result = rag.retrieve(question)
        elapsed.append(time.time() - started)
        actual = [(doc['id'], [c['id'] for c in chunks]) for doc, chunks in result['references']]
        if actual == expected:
            same += 1
        else:
            print(f'■ 不同：{question}（{result["method"]}）\n  numpy：{expected}\n  pgvector：{actual}')
    print(f'\n{len(questions)} 題，結果完全相同 {same} 題')
    print(f'pgvector 版每題檢索（含問題轉向量、連線資料庫）平均 {np.mean(elapsed[1:]) * 1000:.0f} 毫秒')


if __name__ == '__main__':
    main()
