"""
測試 google_token.verify：用自己產生的 RSA 金鑰簽出假的 Google token，確認該通過的通過、該擋的擋下

使用方式（在專案資料夾執行；需要 cryptography，只在本機測試用）：
  backend/.venv/Scripts/python backend/test_google_token.py
"""

import base64
import json
import sys
import time

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

import google_token

CLIENT_ID = 'test-client.apps.googleusercontent.com'
private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
numbers = private_key.public_key().public_numbers()
KEYS = {'test-kid': (numbers.n, numbers.e)}


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def make_token(key=private_key, header=None, **claims):
    now = int(time.time())
    payload = {
        'iss': 'https://accounts.google.com', 'aud': CLIENT_ID, 'sub': '1234567890',
        'email': 'tester@example.com', 'email_verified': True, 'name': '測試會員',
        'iat': now, 'exp': now + 3600, **claims,
    }
    header = header or {'alg': 'RS256', 'kid': 'test-kid', 'typ': 'JWT'}
    signing_input = f'{b64(json.dumps(header).encode())}.{b64(json.dumps(payload).encode())}'
    signature = key.sign(signing_input.encode(), padding.PKCS1v15(), hashes.SHA256())
    return f'{signing_input}.{b64(signature)}'


def tamper(token):
    """改掉內容（把 sub 換成別人）、保留原本的簽章"""
    header, payload, signature = token.split('.')
    data = json.loads(base64.urlsafe_b64decode(payload + '=='))
    data['sub'] = 'someone-else'
    return f'{header}.{b64(json.dumps(data).encode())}.{signature}'


CASES = [
    ('正常的 token', make_token(), True),
    ('內容被竄改', tamper(make_token()), False),
    ('用別的金鑰簽的', make_token(key=other_key), False),
    ('發給別的網站（aud 不同）', make_token(aud='other-site.apps.googleusercontent.com'), False),
    ('不是 Google 發的', make_token(iss='https://evil.example.com'), False),
    ('已經過期', make_token(exp=int(time.time()) - 3600), False),
    ('Email 沒有驗證', make_token(email_verified=False), False),
    ('演算法改成 none', make_token(header={'alg': 'none', 'kid': 'test-kid'}), False),
    ('格式錯誤', 'not-a-jwt', False),
]


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    passed = 0
    for name, token, should_pass in CASES:
        try:
            google_token.verify(token, CLIENT_ID, keys=KEYS)
            ok, reason = True, ''
        except google_token.InvalidToken as error:
            ok, reason = False, str(error)
        result = '✓' if ok == should_pass else '✗'
        passed += ok == should_pass
        print(f'{result} {name}：{"通過" if ok else "擋下（" + reason + "）"}')
    print(f'\n{passed}/{len(CASES)} 項符合預期')
    sys.exit(0 if passed == len(CASES) else 1)


if __name__ == '__main__':
    main()
