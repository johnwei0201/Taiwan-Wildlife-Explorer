"""
轉向量（建立資料用，PyTorch 版）：build_index.py 把全部塊轉成向量、verify_onnx.py 比對線上版

模型：intfloat/multilingual-e5-small
  - 多語言（中文表現不錯）、384 維、體積小
  - 第一次使用會自動從 Hugging Face 下載，之後用電腦裡的快取
  - 使用規則：文件前面加「passage: 」、問題前面加「query: 」，兩邊的向量才比對得準

線上 API 不用這個檔案（PyTorch 太大），改用 query_encoder.py（同一個模型的 ONNX 量化版）
"""

from functools import lru_cache

MODEL_NAME = 'intfloat/multilingual-e5-small'


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
