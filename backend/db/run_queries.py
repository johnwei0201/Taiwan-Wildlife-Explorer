"""
執行 SQL 檔裡的查詢，把結果印成表格（只讀取、不修改資料）

使用方式（在專案資料夾執行；需要 backend/.env 裡的 DATABASE_URL）：
  backend/.venv/Scripts/python backend/db/run_queries.py                       → 執行 example_queries.sql
  backend/.venv/Scripts/python backend/db/run_queries.py 其他檔案.sql
"""

import os
import sys
import unicodedata
from pathlib import Path

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FILE = Path(__file__).resolve().parent / 'example_queries.sql'


def width(text):
    """中文字在終端機占兩格寬，對齊欄位時要算進去"""
    return sum(2 if unicodedata.east_asian_width(ch) in 'WF' else 1 for ch in text)


def print_table(columns, rows):
    cells = [[('' if v is None else str(v)) for v in row] for row in rows]
    widths = [max(width(c) for c in [name] + [r[i] for r in cells]) for i, name in enumerate(columns)]
    line = lambda values: '  '.join(v + ' ' * (w - width(v)) for v, w in zip(values, widths))
    print(line(columns))
    print('  '.join('-' * w for w in widths))
    for r in cells:
        print(line(r))


def split_queries(sql):
    """以分號切開，每段前面的「-- 」註解第一行當標題（檔案開頭的說明註解不算）"""
    for block in sql.split(';'):
        lines = block.strip().splitlines()
        comments = [l for l in lines if l.startswith('--')]
        body = '\n'.join(l for l in lines if not l.startswith('--')).strip()
        if body:
            yield (comments[-1][2:].strip() if comments else ''), body


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    load_dotenv(ROOT / 'backend' / '.env')
    sql_file = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_FILE

    with psycopg.connect(os.environ['DATABASE_URL']) as conn:
        conn.read_only = True  # 範例查詢只讀取，萬一檔案裡混了修改資料的指令也不會執行
        for title, query in split_queries(sql_file.read_text(encoding='utf-8')):
            cur = conn.execute(query)
            print(f'\n■ {title}')
            print_table([d.name for d in cur.description], cur.fetchall())


if __name__ == '__main__':
    main()
