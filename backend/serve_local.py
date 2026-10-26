"""
在自己電腦執行 AI 動物通 API（和 Vercel 上的 api/ask.py 是同一份程式）

使用方式（在專案資料夾執行）：
  backend/.venv/Scripts/python backend/serve_local.py
  → http://localhost:8000/api/ask
"""

import importlib.util
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path

PORT = 8000
API_FILE = Path(__file__).resolve().parent.parent / 'api' / 'ask.py'


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    spec = importlib.util.spec_from_file_location('ask_api', API_FILE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    print(f'AI 動物通 API：http://localhost:{PORT}/api/ask')
    ThreadingHTTPServer(('127.0.0.1', PORT), module.handler).serve_forever()


if __name__ == '__main__':
    main()
