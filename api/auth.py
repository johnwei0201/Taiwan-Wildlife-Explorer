"""
會員登入 API（Vercel Python Function）：使用 Google 帳號登入

  GET    /api/auth                 → {user, clientId}：目前登入的會員（沒登入是 null）、Google 登入用的 Client ID
  POST   /api/auth  {credential}   → 用 Google 給的 ID token 登入，設定登入 cookie，回傳 {user}
  DELETE /api/auth                 → 登出
  DELETE /api/auth?scope=account   → 刪除帳號（生命清單、收藏一起刪除）

登入狀態存在 cookie「session」：HttpOnly（網頁的 JavaScript 讀不到，防止被惡意程式偷走）、
Secure（只走 HTTPS）、SameSite=Lax（別的網站送來的 POST 不會帶上它）
Client ID 設定在環境變數 GOOGLE_CLIENT_ID（不是機密，網頁上本來就看得到）
"""

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'backend'))
import account  # noqa: E402
import google_token  # noqa: E402
from web import BadRequest, JsonHandler  # noqa: E402

COOKIE = 'session'
COOKIE_OPTIONS = 'Path=/; HttpOnly; Secure; SameSite=Lax'


def session_cookie(token):
    return f'{COOKIE}={token}; {COOKIE_OPTIONS}; Max-Age={account.SESSION_DAYS * 24 * 60 * 60}'


CLEAR_COOKIE = f'{COOKIE}=; {COOKIE_OPTIONS}; Max-Age=0'


class handler(JsonHandler):
    def do_GET(self):
        try:
            user = account.current_user(self.cookie(COOKIE))
        except Exception as error:
            print(f'[auth] 資料庫無法使用：{type(error).__name__}: {error}')
            return self.send_json(503, {'detail': '會員功能暫時無法使用'})
        self.send_json(200, {'user': user, 'clientId': os.environ.get('GOOGLE_CLIENT_ID')})

    def do_POST(self):
        client_id = os.environ.get('GOOGLE_CLIENT_ID')
        if not client_id:
            return self.send_json(503, {'detail': '會員功能準備中'})
        if not self.same_origin():
            return self.send_json(403, {'detail': '來源不正確'})
        try:
            credential = str(self.read_json().get('credential', ''))
            google_user = google_token.verify(credential, client_id)
        except BadRequest as error:
            return self.send_json(error.status, {'detail': error.detail})
        except google_token.InvalidToken as error:
            print(f'[auth] Google 登入驗證失敗：{error}')
            return self.send_json(401, {'detail': 'Google 登入驗證失敗，請再試一次'})
        except Exception as error:  # 下載 Google 公鑰失敗等
            print(f'[auth] 錯誤：{type(error).__name__}: {error}')
            return self.send_json(503, {'detail': '暫時無法登入，請稍後再試'})

        try:
            user, token = account.login(google_user)
        except Exception as error:
            print(f'[auth] 資料庫無法使用：{type(error).__name__}: {error}')
            return self.send_json(503, {'detail': '會員功能暫時無法使用'})
        self.send_json(200, {'user': user}, cookies=[session_cookie(token)])

    def do_DELETE(self):
        if not self.same_origin():
            return self.send_json(403, {'detail': '來源不正確'})
        token = self.cookie(COOKIE)
        try:
            if self.query('scope') == 'account':
                user = account.current_user(token)
                if not user:
                    return self.send_json(401, {'detail': '請先登入'})
                account.delete_user(user['id'])
            elif token:
                account.logout(token)
        except Exception as error:
            print(f'[auth] 資料庫無法使用：{type(error).__name__}: {error}')
            return self.send_json(503, {'detail': '會員功能暫時無法使用'})
        self.send_json(200, {'user': None}, cookies=[CLEAR_COOKIE])
