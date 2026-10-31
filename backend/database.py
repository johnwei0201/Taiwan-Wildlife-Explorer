"""
線上 API 連接 PostgreSQL（Neon）：問答紀錄（ask_log.py）和向量搜尋（rag.py）共用同一條連線

  run(work)                    → 執行 work(cursor)，只讀取資料時用（每個指令單獨生效）
  run(work, transaction=True)  → 在一個交易裡執行，全部成功才 commit；寫入多筆、需要一起成功時用

只讀取時不開交易：每開一次交易要多送 BEGIN、COMMIT，實測一次查詢從約 90 毫秒變成約 430 毫秒（臺灣連到新加坡）

連線套件用 pg8000（純 Python，約 2 MB），不用 psycopg：
  psycopg 的 binary 版附了 PostgreSQL 的 C 程式庫（約 23 MB），會讓 Vercel 函式超過 225 MB 的上限
  本機的匯入、查詢程式（backend/db/）仍用 psycopg，因為它支援 COPY 大量寫入
"""

import os
import ssl
import threading
from pathlib import Path
from urllib.parse import unquote, urlparse

import pg8000.dbapi
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / '.env')  # 本機讀 backend/.env；Vercel 用環境變數

_conn = None
_lock = threading.Lock()  # 本機測試伺服器會同時處理多個請求，同一條連線一次只給一個請求用


def connect():
    """pg8000 不直接接受連線字串，先把 postgresql://帳號:密碼@主機/資料庫 拆開"""
    url = urlparse(os.environ['DATABASE_URL'])
    conn = pg8000.dbapi.connect(
        user=unquote(url.username), password=unquote(url.password or ''),
        host=url.hostname, port=url.port or 5432, database=url.path.lstrip('/'),
        ssl_context=ssl.create_default_context(),  # Neon 只接受加密連線，並驗證主機的憑證
        timeout=10,
    )
    conn.autocommit = True  # 預設每個指令單獨生效；需要交易時 run() 自己送 BEGIN／COMMIT
    return conn


def get_connection():
    """沿用同一條連線：Vercel 的主機處理完請求後會保留一段時間，下一個請求就不用重新連線"""
    global _conn
    if _conn is None:
        _conn = connect()
    return _conn


def run(work, transaction=False):
    """執行資料庫操作；transaction=True 時包在一個交易裡，全部成功才 commit

    出錯時直接關掉這條連線（可能已經斷線），交易裡還沒 commit 的修改會被資料庫丟棄；下次重新連線
    """
    global _conn
    with _lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            if transaction:
                cursor.execute('BEGIN')
            result = work(cursor)
            if transaction:
                cursor.execute('COMMIT')
            return result
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
            _conn = None
            raise


def ping():
    """確認資料庫連得上（GET /api/ask 用）"""
    def work(cursor):
        cursor.execute('SELECT 1')
        return cursor.fetchone()[0] == 1

    return run(work)
