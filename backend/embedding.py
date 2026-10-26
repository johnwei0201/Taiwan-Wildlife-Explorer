"""
轉向量的共用工具（3-2 建立向量資料庫、3-3 回答問題都會用到）

模型：intfloat/multilingual-e5-small
  - 多語言（中文表現不錯）、體積小（約 470 MB），免費主機（Hugging Face Spaces）也跑得動
  - 第一次使用會自動從 Hugging Face 下載，之後用電腦裡的快取
  - 使用規則：文件前面加「passage: 」、問題前面加「query: 」，兩邊的向量才比對得準
"""

import os
from functools import lru_cache
from pathlib import Path

import chromadb

MODEL_NAME = 'intfloat/multilingual-e5-small'
COLLECTION_NAME = 'species_chunks'


def _index_dir():
    """向量資料庫的位置：預設 backend/index/

    Chroma 底層讀 HNSW 索引的程式不支援中文路徑（存得進去、重新打開卻讀不到），
    所以專案放在中文資料夾時，改存到使用者資料夾底下的英文路徑
    """
    default = Path(__file__).resolve().parent / 'index'
    if str(default).isascii():
        return default
    return Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'taiwan-wildlife' / 'index'


INDEX_DIR = _index_dir()


@lru_cache(maxsize=1)
def get_model():
    """載入模型（只載入一次，之後重複使用）"""
    from sentence_transformers import SentenceTransformer  # 載入要幾秒，用到時才匯入
    return SentenceTransformer(MODEL_NAME)


def embed_passages(texts, batch_size=64, show_progress=True):
    """文件（塊）→ 向量；normalize 後，向量的內積就等於餘弦相似度"""
    return get_model().encode(
        [f'passage: {text}' for text in texts],
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=show_progress,
    ).tolist()


def embed_query(text):
    """問題 → 向量"""
    return get_model().encode(f'query: {text}', normalize_embeddings=True).tolist()


def get_collection(create=False):
    """打開向量資料庫（Chroma，位置見 INDEX_DIR）；create=True 時清空重建"""
    client = chromadb.PersistentClient(path=str(INDEX_DIR))
    if create:
        if COLLECTION_NAME in [c.name for c in client.list_collections()]:
            client.delete_collection(COLLECTION_NAME)
        # cosine：用餘弦相似度比對（距離 = 1 - 相似度，越小越像）
        return client.create_collection(COLLECTION_NAME, metadata={'hnsw:space': 'cosine'})
    return client.get_collection(COLLECTION_NAME)
