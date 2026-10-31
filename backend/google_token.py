"""
驗證「使用 Google 帳號登入」的 ID token（JWT），確認真的是 Google 發的、而且是發給本站的

  verify(credential, client_id) → {'sub', 'email', 'name', 'picture'}；不合格就丟出 InvalidToken

為什麼自己寫，不用 Google 的 google-auth 套件：
  google-auth 需要 cryptography 等套件（約 27 MB），會讓 Vercel 函式超過 225 MB 的上限
  RS256 簽章驗證只需要 Python 內建的大數運算（pow）和 SHA-256，不用額外套件

JWT 是三段用「.」接起來的 base64url：標頭.內容.簽章
  1. 標頭的 kid 指出用 Google 的哪一把金鑰簽的 → 到 Google 公開的網址下載公鑰（有快取）
  2. 用公鑰檢查簽章：任何人改了標頭或內容，簽章就對不上
  3. 檢查內容：發行者是 Google、對象（aud）是本站的 Client ID、還沒過期、Email 已驗證
"""

import base64
import hashlib
import hmac
import json
import re
import time
import urllib.request

GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
ISSUERS = {'accounts.google.com', 'https://accounts.google.com'}
CLOCK_SKEW = 60  # 容許伺服器和 Google 的時鐘相差 60 秒

# SHA-256 的 DigestInfo 開頭（PKCS#1 v1.5 規定的固定位元組，見 RFC 8017 第 9.2 節）
SHA256_PREFIX = bytes.fromhex('3031300d060960864801650304020105000420')

_keys = {}           # kid → (n, e)
_keys_expire = 0.0   # 公鑰快取的到期時間


class InvalidToken(Exception):
    pass


def b64decode(text):
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def load_keys(force=False):
    """下載 Google 的公鑰；依回應的 Cache-Control 快取（Google 會定期換金鑰）"""
    global _keys, _keys_expire
    if not force and time.time() < _keys_expire:
        return _keys
    with urllib.request.urlopen(GOOGLE_CERTS_URL, timeout=5) as response:
        data = json.load(response)
        max_age = re.search(r'max-age=(\d+)', response.headers.get('Cache-Control', ''))
    _keys = {
        key['kid']: (int.from_bytes(b64decode(key['n']), 'big'), int.from_bytes(b64decode(key['e']), 'big'))
        for key in data['keys']
        if key.get('kty') == 'RSA'
    }
    _keys_expire = time.time() + (int(max_age.group(1)) if max_age else 3600)
    return _keys


def verify_rs256(signing_input, signature, n, e):
    """RSA PKCS#1 v1.5 + SHA-256 簽章驗證

    做法是「照規定組出應該要有的內容，再整段比對」，不去拆解簽章的內容：
    拆解的寫法曾經出過偽造簽章的漏洞（Bleichenbacher 2006），整段比對沒有這個問題
    """
    size = (n.bit_length() + 7) // 8
    if len(signature) != size:
        return False
    decrypted = pow(int.from_bytes(signature, 'big'), e, n).to_bytes(size, 'big')
    digest_info = SHA256_PREFIX + hashlib.sha256(signing_input).digest()
    expected = b'\x00\x01' + b'\xff' * (size - len(digest_info) - 3) + b'\x00' + digest_info
    return hmac.compare_digest(decrypted, expected)  # 比對時間固定，不會因為前面幾個位元組相同而洩漏資訊


def verify(credential, client_id, keys=None):
    try:
        header_b64, payload_b64, signature_b64 = credential.split('.')
        header = json.loads(b64decode(header_b64))
        payload = json.loads(b64decode(payload_b64))
        signature = b64decode(signature_b64)
    except (ValueError, AttributeError):
        raise InvalidToken('格式錯誤')

    # 只接受 RS256：不讓對方指定其他演算法（例如 none、HS256）來繞過驗證
    if header.get('alg') != 'RS256':
        raise InvalidToken('不支援的演算法')
    keys = keys if keys is not None else load_keys()
    if header.get('kid') not in keys:
        keys = load_keys(force=True)  # Google 可能剛換了金鑰，重新下載一次
    if header.get('kid') not in keys:
        raise InvalidToken('找不到簽章用的金鑰')
    if not verify_rs256(f'{header_b64}.{payload_b64}'.encode(), signature, *keys[header['kid']]):
        raise InvalidToken('簽章不正確')

    now = time.time()
    if payload.get('iss') not in ISSUERS:
        raise InvalidToken('不是 Google 發的')
    if payload.get('aud') != client_id:
        raise InvalidToken('不是發給本站的')  # 別的網站拿到的 token 不能拿來登入本站
    if not isinstance(payload.get('exp'), (int, float)) or payload['exp'] < now - CLOCK_SKEW:
        raise InvalidToken('已經過期')
    if isinstance(payload.get('iat'), (int, float)) and payload['iat'] > now + CLOCK_SKEW:
        raise InvalidToken('發行時間不正確')
    if not payload.get('sub') or not payload.get('email') or payload.get('email_verified') is not True:
        raise InvalidToken('Email 尚未驗證')

    return {
        'sub': payload['sub'],
        'email': payload['email'],
        'name': payload.get('name'),
        'picture': payload.get('picture'),
    }
