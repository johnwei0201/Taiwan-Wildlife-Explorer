"""
驗證：ONNX 量化版（線上用）和 PyTorch 版（建立資料用）算出的問題向量是否幾乎一樣

使用方式（在專案資料夾執行；需要安裝 requirements-build.txt）：
  backend/.venv/Scripts/python backend/verify_onnx.py

看兩個數字：
  - 相似度：同一個問題兩邊算出的向量，餘弦相似度越接近 1 越好
  - 前 5 名重疊：用兩邊的向量搜尋，找到的前 5 塊有幾塊一樣
"""

import json
import sys
from pathlib import Path

import numpy as np

import embedding
import query_encoder

DATA_DIR = Path(__file__).resolve().parent / 'data'
QUESTIONS = [
    '臺灣藍鵲吃什麼？', '有哪些住在高山的鳥？', '會吃昆蟲的青蛙有哪些？', '什麼是特有種？',
    '晚上活動、會吃魚的鳥', '有毒的蛇', '石虎住在哪裡', 'Formosan blue magpie',
]


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    vectors = np.load(DATA_DIR / 'vectors.npy')
    for question in QUESTIONS:
        torch_vector = np.array(embedding.embed_query(question), dtype=np.float32)
        onnx_vector = query_encoder.embed_query(question)
        top_torch = set(np.argsort(-(vectors @ torch_vector))[:5])
        top_onnx = set(np.argsort(-(vectors @ onnx_vector))[:5])
        print(f'{question}｜相似度 {float(torch_vector @ onnx_vector):.4f}｜前 5 名重疊 {len(top_torch & top_onnx)}/5')


if __name__ == '__main__':
    main()
