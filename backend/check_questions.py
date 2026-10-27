"""
檢查前端的範例問題（src/constants/askQuestions.js）：每一題的檢索結果
只做檢索、不呼叫 Claude，所以不花錢、也不需要 API 金鑰

使用方式（在專案資料夾執行）：
  backend/.venv/Scripts/python backend/check_questions.py
"""

import re
import sys
from pathlib import Path

from rag import retrieve

QUESTIONS_FILE = Path(__file__).resolve().parent.parent / 'src' / 'constants' / 'askQuestions.js'


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    # 題目是 JS 陣列裡用單引號包起來的字串（註解裡的字不算）
    source = '\n'.join(line for line in QUESTIONS_FILE.read_text(encoding='utf-8').splitlines()
                       if not line.strip().startswith('//'))
    questions = re.findall(r"'([^']+)'", source)
    print(f'共 {len(questions)} 題（重複 {len(questions) - len(set(questions))} 題）')
    for question in questions:
        result = retrieve(question)
        names = '、'.join(document['name'] for document, _ in result['references'])
        print(f"■ {question}（{result['method']}）\n  {names or '（沒有找到）'}")


if __name__ == '__main__':
    main()
