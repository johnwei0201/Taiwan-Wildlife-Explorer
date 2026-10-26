"""
AI 動物通 API（Vercel Python Function）：網站把問題送到 POST /api/ask，回傳回答

  POST /api/ask  {"question": "臺灣藍鵲吃什麼？"}  →  {answer, sources, followUps, mode}
  GET  /api/ask  → {"status": "ok"}（確認 API 有在運作）

回答的邏輯在 backend/rag.py；這個檔案只負責收發 HTTP、檢查輸入、限制次數
用 Python 內建的 BaseHTTPRequestHandler，不用 FastAPI：
  Vercel 偵測到 FastAPI 會把整個網站交給 Python 處理，可能影響 React 前端

金鑰 ANTHROPIC_API_KEY 設定在 Vercel 專案的 Settings → Environment Variables，不放在程式裡
本機測試：backend/serve_local.py
"""

import json
import sys
import time
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'backend'))
from rag import answer_question  # noqa: E402

MAX_QUESTION_LENGTH = 200

# 次數限制：防止有人狂刷、把 Claude 額度用光
# （Vercel 會同時開好幾台主機，每台各自計算，所以實際上會比這裡寬鬆；額度是預付制，用完就停）
PER_IP_LIMITS = [(60, 5), (24 * 60 * 60, 50)]  # 同一個 IP：每分鐘 5 題、每天 50 題
DAILY_TOTAL_LIMIT = 500                        # 每台主機每天 500 題

ip_history = defaultdict(deque)  # IP → 最近 24 小時的提問時間
total_history = deque()          # 最近 24 小時的提問時間


def rate_limit_message(ip):
    """超過次數時回傳提示文字；沒超過就記錄這次提問，回傳 None"""
    now = time.time()
    history = ip_history[ip]
    for times in (history, total_history):
        while times and now - times[0] > 24 * 60 * 60:
            times.popleft()
    for window, limit in PER_IP_LIMITS:
        if sum(1 for t in history if now - t <= window) >= limit:
            return '問得太快了，請稍等一下再問'
    if len(total_history) >= DAILY_TOTAL_LIMIT:
        return '今天的提問次數已達上限，請明天再來'
    history.append(now)
    total_history.append(now)
    return None


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_json(200, {'status': 'ok'})

    def do_POST(self):
        length = int(self.headers.get('content-length') or 0)
        if length > 4000:
            return self.send_json(413, {'detail': '問題太長了'})
        try:
            body = json.loads(self.rfile.read(length) or b'{}')
            question = str(body.get('question', '')).strip()
        except (ValueError, AttributeError):
            return self.send_json(400, {'detail': '格式錯誤'})
        if not question or len(question) > MAX_QUESTION_LENGTH:
            return self.send_json(422, {'detail': f'問題要在 1～{MAX_QUESTION_LENGTH} 字之間'})

        # Vercel 在前面有一層轉送，真正的 IP 在 X-Forwarded-For 的第一個
        ip = (self.headers.get('x-forwarded-for') or self.client_address[0]).split(',')[0].strip()
        message = rate_limit_message(ip)
        if message:
            return self.send_json(429, {'detail': message})

        try:
            result = answer_question(question)
        except Exception as error:  # 例如模型下載失敗；記錄下來，回傳一般的錯誤訊息
            print(f'[ask] 錯誤：{type(error).__name__}: {error}')
            return self.send_json(500, {'detail': 'AI 動物通暫時無法使用，請稍後再試'})
        print(f"[ask] {result['mode']}｜{result['method']}｜{question}")  # 記錄在 Vercel 的 Logs，方便除錯
        self.send_json(200, {key: result[key] for key in ('answer', 'sources', 'followUps', 'mode')})

    def send_json(self, status, data):
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
