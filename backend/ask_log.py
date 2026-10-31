"""
AI 動物通的問答紀錄與次數限制（PostgreSQL 的 ask_logs、ask_log_sources，結構見 backend/db/schema.sql）

  start(ip, question)   → 檢查次數限制；沒超過就新增一筆紀錄，回傳 (紀錄 id, None)；超過回傳 (None, 提示文字)
  finish(log_id, ...)   → 回答完成後，補上模式、用量、花費時間、引用的物種

次數限制用資料庫計算：Vercel 會同時開好幾台主機，存在記憶體的話每台各算各的；
存在資料庫，所有主機看到的是同一份紀錄
資料庫連不上時會丟出例外，由 api/ask.py 改用記憶體計算，AI 動物通不會因此停擺
"""

import hashlib
import hmac
import os
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / '.env')  # 本機讀 backend/.env；Vercel 用環境變數

PER_MINUTE_LIMIT = 5      # 同一位訪客每分鐘最多 5 題
PER_DAY_LIMIT = 50        # 同一位訪客每天最多 50 題
DAILY_TOTAL_LIMIT = 500   # 全站每天最多 500 題（防止額度被一次用光）

TAIPEI = timezone(timedelta(hours=8))  # 臺灣沒有日光節約時間，固定 UTC+8

_conn = None
_lock = threading.Lock()  # 本機測試伺服器會同時處理多個請求，同一條連線一次只給一個請求用


def get_connection():
    """沿用同一條連線：Vercel 的主機處理完請求後會保留一段時間，下一個請求就不用重新連線"""
    global _conn
    if _conn is None or _conn.closed:
        # autocommit：每個指令單獨生效，需要一起成功的部分再用 transaction() 包起來
        # prepare_threshold=None：不用 prepared statement，Neon 的連線池（pooler）才不會出問題
        _conn = psycopg.connect(
            os.environ['DATABASE_URL'], autocommit=True, prepare_threshold=None, connect_timeout=5,
        )
    return _conn


def run(work):
    """執行資料庫操作；連線斷掉時丟掉舊連線，下次重新連線"""
    global _conn
    with _lock:
        try:
            return work(get_connection())
        except psycopg.OperationalError:
            if _conn is not None:
                _conn.close()
            _conn = None
            raise


def client_hash(ip):
    """訪客代號：用 HMAC 把「臺灣日期＋IP」變成一串亂碼，資料庫裡不存 IP

    - 加上日期：同一個 IP 每天的代號都不同，無法跨日追蹤同一個人
    - 用 HMAC 加上密鑰：IPv4 只有約 43 億種，單純雜湊可以被逐一試出來；沒有密鑰就試不出來
      密鑰沿用資料庫的連線字串（本來就是機密），不用另外設定環境變數
    """
    key = os.environ['DATABASE_URL'].encode()
    today = datetime.now(TAIPEI).date().isoformat()
    return hmac.new(key, f'{today}|{ip}'.encode(), hashlib.sha256).hexdigest()[:32]


def start(ip, question):
    visitor = client_hash(ip)

    def work(conn):
        # 檢查次數和新增紀錄要在同一個交易裡，並先鎖住這位訪客：
        # 同一位訪客同時送出兩題時，第二題會等第一題寫完才開始計算，不會兩題都以為還沒超過
        # （advisory lock 是 PostgreSQL 的「自訂名稱鎖」，交易結束時自動解開）
        with conn.transaction():
            conn.execute('SELECT pg_advisory_xact_lock(hashtext(%s))', (visitor,))
            # 「今天」以臺灣時間的午夜為準，和訪客代號的換日時間一致
            per_minute, per_day, total_today = conn.execute(
                """
                WITH today AS (
                    SELECT (date_trunc('day', now() AT TIME ZONE 'Asia/Taipei') AT TIME ZONE 'Asia/Taipei') AS start
                )
                SELECT count(*) FILTER (WHERE client_hash = %(visitor)s AND created_at > now() - interval '1 minute'),
                       count(*) FILTER (WHERE client_hash = %(visitor)s),
                       count(*)
                FROM ask_logs, today
                WHERE created_at >= today.start
                """,
                {'visitor': visitor},
            ).fetchone()
            if per_minute >= PER_MINUTE_LIMIT or per_day >= PER_DAY_LIMIT:
                return None, '問得太快了，請稍等一下再問' if per_minute >= PER_MINUTE_LIMIT else '今天問了很多題囉，請明天再來'
            if total_today >= DAILY_TOTAL_LIMIT:
                return None, '今天的提問次數已達上限，請明天再來'
            log_id = conn.execute(
                'INSERT INTO ask_logs (client_hash, question) VALUES (%s, %s) RETURNING id', (visitor, question),
            ).fetchone()[0]
            return log_id, None

    return run(work)


def finish(log_id, result=None, duration_ms=None):
    """補上回答的結果；result 是 None 代表回答失敗"""
    usage = (result or {}).get('usage', {})

    def work(conn):
        with conn.transaction():
            conn.execute(
                """
                UPDATE ask_logs
                SET status = %s, mode = %s, method = %s, input_tokens = %s, output_tokens = %s, duration_ms = %s
                WHERE id = %s
                """,
                (
                    'answered' if result else 'error', (result or {}).get('mode'), (result or {}).get('method'),
                    usage.get('input'), usage.get('output'), duration_ms, log_id,
                ),
            )
            if result and result['sources']:
                conn.cursor().executemany(
                    'INSERT INTO ask_log_sources (log_id, species_id, position) VALUES (%s, %s, %s)',
                    [(log_id, species_id, i) for i, species_id in enumerate(result['sources'], 1)],
                )

    run(work)


def ping():
    """確認資料庫連得上（GET /api/ask 用）"""
    return run(lambda conn: conn.execute('SELECT 1').fetchone()[0] == 1)
