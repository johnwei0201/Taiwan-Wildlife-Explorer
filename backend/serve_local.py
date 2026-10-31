"""
在自己電腦執行網站的 API（和 Vercel 上的 api/*.py 是同一份程式）

使用方式（在專案資料夾執行）：
  backend/.venv/Scripts/python backend/serve_local.py
  → http://localhost:8000/api/ask、/api/auth、/api/collection

Vercel 會依檔名把 /api/xxx 交給 api/xxx.py；這裡用同樣的規則轉給對應檔案的 handler
"""

import importlib.util
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

PORT = 8000
API_DIR = Path(__file__).resolve().parent.parent / 'api'


def load_handlers():
    handlers = {}
    for file in sorted(API_DIR.glob('*.py')):
        spec = importlib.util.spec_from_file_location(f'api_{file.stem}', file)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        handlers[f'/api/{file.stem}'] = module.handler
    return handlers


HANDLERS = load_handlers()


class Router(BaseHTTPRequestHandler):
    """讀完請求的第一行才知道網址，所以先用這個類別接收，再「變身」成對應 API 的 handler 處理"""

    def route(self):
        target = HANDLERS.get(urlparse(self.path).path.rstrip('/'))
        if target is None:
            self.send_error(404)
            return None
        self.__class__ = target  # 所有 handler 都是 BaseHTTPRequestHandler，已經讀好的請求內容可以直接沿用
        return self

    def do_GET(self):
        if self.route():
            self.do_GET()

    def do_POST(self):
        if self.route():
            self.do_POST()

    def do_DELETE(self):
        if self.route():
            self.do_DELETE()


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    print(f'網站 API：{", ".join(f"http://localhost:{PORT}{path}" for path in HANDLERS)}')
    ThreadingHTTPServer(('127.0.0.1', PORT), Router).serve_forever()


if __name__ == '__main__':
    main()
