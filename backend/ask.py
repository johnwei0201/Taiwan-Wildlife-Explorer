"""
3-3 測試回答：用 Claude 回答問題，印出回答、參考物種、延伸問題和花費

使用方式（在專案資料夾執行；需要 backend/.env 裡的 ANTHROPIC_API_KEY，沒有時會用備援模式）：
  backend/.venv/Scripts/python backend/ask.py              → 跑內建的測試問題（約 0.01 美元）
  backend/.venv/Scripts/python backend/ask.py 石虎住在哪裡    → 問自己的問題
"""

import json
import sys

from rag import answer_question, load_data

# Haiku 5.5 價格（美元／每百萬 token）
PRICE_INPUT, PRICE_OUTPUT = 0.10, 0.50

TEST_QUESTIONS = [
    '臺灣藍鵲吃什麼？',
    '黑長尾雉（帝雉）是保育類嗎？',
    '藍腹鷴和黑長尾雉有什麼不同？',
    '什麼是特有種？',
    '有哪些住在高山的鳥？',
    '會吃昆蟲的青蛙有哪些？',
    '晚上活動、會吃魚的鳥',
    '有毒的蛇',
    '田雞仔是什麼鳥',
    '石虎幾月最容易看到？',
    '今天天氣如何',
]


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    documents = load_data()[0]
    species_names = {d['speciesId']: d['name'] for d in documents.values() if d['type'] == 'species'}

    questions = [' '.join(sys.argv[1:])] if len(sys.argv) > 1 else TEST_QUESTIONS
    total_cost = 0
    for question in questions:
        result = answer_question(question)
        print(f"\n■ {question}（{result['method']}，{result['mode']}）")
        print(result['answer'])
        print(f"  參考物種：{'、'.join(species_names[i] for i in result['sources']) or '（無）'}")
        print(f"  延伸問題：{json.dumps(result['followUps'], ensure_ascii=False)}")
        if 'usage' in result:
            cost = result['usage']['input'] * PRICE_INPUT / 1e6 + result['usage']['output'] * PRICE_OUTPUT / 1e6
            total_cost += cost
            print(f"  用量：輸入 {result['usage']['input']}、輸出 {result['usage']['output']} token，約 {cost:.5f} 美元")
    if total_cost:
        print(f'\n總花費：約 {total_cost:.4f} 美元（台幣約 {total_cost * 32:.2f} 元）')


if __name__ == '__main__':
    main()
