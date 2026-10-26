"""
問題 → 向量（線上 API 用的輕量版）

建立資料時用 PyTorch 版模型（embedding.py），但 PyTorch 太大，放不進 Vercel（上限 500 MB）。
線上改用同一個模型的 ONNX 量化版：
  - onnxruntime 執行，不需要 PyTorch；模型從 470 MB 壓到 118 MB（int8 量化）
  - 和 PyTorch 版算出的向量幾乎一樣（verify_onnx.py 驗證過），已經算好的文件向量可以直接沿用
  - 模型第一次使用時從 Hugging Face 下載到暫存資料夾（Vercel 只有 /tmp 可以寫入）
"""

import tempfile
import urllib.request
from functools import lru_cache
from pathlib import Path

import numpy as np

# Xenova/multilingual-e5-small：intfloat/multilingual-e5-small 轉成的 ONNX 版本
# 固定在某個版本（commit），避免作者更新檔案後結果改變
MODEL_REPO = 'Xenova/multilingual-e5-small'
MODEL_REVISION = '761b726dd34fb83930e26aab4e9ac3899aa1fa78'
MODEL_FILES = {'model.onnx': 'onnx/model_quantized.onnx', 'tokenizer.json': 'tokenizer.json'}
CACHE_DIR = Path(tempfile.gettempdir()) / 'taiwan-wildlife-model'
MAX_TOKENS = 128  # 問題最多 200 字，128 個 token 足夠


def download_model():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for local, remote in MODEL_FILES.items():
        path = CACHE_DIR / local
        if not path.exists():
            url = f'https://huggingface.co/{MODEL_REPO}/resolve/{MODEL_REVISION}/{remote}'
            partial = path.with_suffix('.part')  # 下載到一半中斷時，不會留下壞掉的檔案
            urllib.request.urlretrieve(url, partial)
            partial.replace(path)
    return CACHE_DIR


@lru_cache(maxsize=1)
def load_encoder():
    """載入模型（只載入一次）"""
    import onnxruntime
    from tokenizers import Tokenizer

    folder = download_model()
    tokenizer = Tokenizer.from_file(str(folder / 'tokenizer.json'))
    tokenizer.enable_truncation(MAX_TOKENS)
    session = onnxruntime.InferenceSession(str(folder / 'model.onnx'), providers=['CPUExecutionProvider'])
    return tokenizer, session


def embed_query(text):
    """問題 → 384 維向量（和 embedding.py 一樣：加「query: 」、平均池化、長度正規化）"""
    tokenizer, session = load_encoder()
    encoding = tokenizer.encode(f'query: {text}')
    ids = np.array([encoding.ids], dtype=np.int64)
    mask = np.array([encoding.attention_mask], dtype=np.int64)
    inputs = {'input_ids': ids, 'attention_mask': mask}
    if 'token_type_ids' in {i.name for i in session.get_inputs()}:
        inputs['token_type_ids'] = np.zeros_like(ids)
    hidden = session.run(None, inputs)[0]  # (1, token 數, 384)
    # 平均池化：把每個 token 的向量平均成一個（只算真正的字，不算補位）
    vector = (hidden[0] * mask[0][:, None]).sum(axis=0) / mask[0].sum()
    return (vector / np.linalg.norm(vector)).astype(np.float32)
