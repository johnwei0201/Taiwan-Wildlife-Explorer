"""
測試檢索：輸入問題，看混合式檢索（名稱查詢＋向量搜尋）找出來的物種對不對
只做檢索、不呼叫 Claude，所以不花錢、也不需要 API 金鑰

使用方式（在專案資料夾執行）：
  backend/.venv/Scripts/python backend/search_index.py              → 跑內建的測試問題
  backend/.venv/Scripts/python backend/search_index.py 有哪些住在高山的鳥  → 測試自己的問題
"""

import sys

from rag import retrieve

TEST_QUESTIONS = [
    '臺灣藍鵲吃什麼？',
    '有哪些住在高山的鳥？',
    '會吃昆蟲的青蛙有哪些？',
    '什麼是特有種？',
    '晚上活動、會吃魚的鳥',
    '有毒的蛇',
    '蛇鵰吃什麼',
    '田雞仔是什麼鳥',
]


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    questions = [' '.join(sys.argv[1:])] if len(sys.argv) > 1 else TEST_QUESTIONS
    for question in questions:
        result = retrieve(question)
        names = '、'.join(document['name'] for document, _ in result['references'])
        print(f"■ {question}（{result['method']}）\n  {names or '（沒有找到）'}")


if __name__ == '__main__':
    main()
