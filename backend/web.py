"""
API 共用的 HTTP 工具（api/ask.py、api/auth.py、api/collection.py）

用 Python 內建的 BaseHTTPRequestHandler，不用 FastAPI：
  Vercel 偵測到 FastAPI 會把整個網站交給 Python 處理，可能影響 React 前端
"""

import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

MAX_BODY = 4000  # 請求內容最多幾個位元組（Google 的 token 約 1,200 字元）


class BadRequest(Exception):
    def __init__(self, status, detail):
        super().__init__(detail)
        self.status, self.detail = status, detail


class JsonHandler(BaseHTTPRequestHandler):
    def read_json(self):
        length = int(self.headers.get('content-length') or 0)
        if length > MAX_BODY:
            raise BadRequest(413, '內容太長了')
        try:
            body = json.loads(self.rfile.read(length) or b'{}')
        except ValueError:
            raise BadRequest(400, '格式錯誤')
        if not isinstance(body, dict):
            raise BadRequest(400, '格式錯誤')
        return body

    def query(self, name):
        return (parse_qs(urlparse(self.path).query).get(name) or [None])[0]

    def cookie(self, name):
        """從 Cookie 標頭取出某個 cookie 的值

        不用 Python 的 SimpleCookie：Google 登入按鈕會在本站存一個 g_state={"i_l":0} 的 cookie，
        SimpleCookie 遇到這種含引號、大括號的值就停止解析，排在它後面的 session 會讀不到（登入後換頁就變成沒登入）
        瀏覽器送來的格式是「名稱=值; 名稱=值」，直接切開就好
        """
        for part in (self.headers.get('cookie') or '').split(';'):
            key, _, value = part.strip().partition('=')
            if key == name:
                return value
        return None

    def client_ip(self):
        # Vercel 在前面有一層轉送，真正的 IP 在 X-Forwarded-For 的第一個
        return (self.headers.get('x-forwarded-for') or self.client_address[0]).split(',')[0].strip()

    def same_origin(self):
        """會修改資料的請求，要確認是從本站的網頁送出的（防止 CSRF：別的網站偷偷用訪客的登入狀態送請求）

        cookie 已經設了 SameSite=Lax，這裡是第二道防線；瀏覽器送 POST、DELETE 時一定會帶 Origin
        """
        origin = self.headers.get('origin')
        if origin is None:
            return True  # 不是瀏覽器發出的（例如 curl），沒有 cookie 可以被冒用
        host = self.headers.get('x-forwarded-host') or self.headers.get('host')
        return urlparse(origin).netloc == host

    def send_json(self, status, data, cookies=()):
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')  # 回應和登入狀態有關，不能被快取
        for cookie in cookies:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(payload)
