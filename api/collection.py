"""
生命清單、收藏 API（Vercel Python Function）：需要登入

  GET    /api/collection                                  → {seen: [物種 id], favorite: [...], groups: [各類群完成度]}
  POST   /api/collection  {speciesId, list}               → 加入清單（list 是 seen 或 favorite），回傳新的清單
  DELETE /api/collection?speciesId=5043&list=seen         → 移出清單，回傳新的清單
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'backend'))
import account  # noqa: E402
from web import BadRequest, JsonHandler  # noqa: E402


def parse_item(species_id, list_name):
    try:
        species_id = int(species_id)
    except (TypeError, ValueError):
        raise BadRequest(422, '物種編號不正確')
    if list_name not in account.LISTS:
        raise BadRequest(422, '清單名稱不正確')
    return species_id, list_name


class handler(JsonHandler):
    def do_GET(self):
        self.handle_request(lambda user: None)

    def do_POST(self):
        def change(user):
            body = self.read_json()
            species_id, list_name = parse_item(body.get('speciesId'), body.get('list'))
            if not account.add(user['id'], species_id, list_name):
                raise BadRequest(404, '本站沒有收錄這個物種')

        self.handle_request(change)

    def do_DELETE(self):
        def change(user):
            account.remove(user['id'], *parse_item(self.query('speciesId'), self.query('list')))

        self.handle_request(change)

    def handle_request(self, change):
        """共同流程：檢查來源 → 確認登入 → 修改清單（GET 不修改）→ 回傳最新的清單"""
        if self.command != 'GET' and not self.same_origin():
            return self.send_json(403, {'detail': '來源不正確'})
        try:
            user = account.current_user(self.cookie('session'))
            if not user:
                return self.send_json(401, {'detail': '請先登入'})
            change(user)
            self.send_json(200, account.collection(user['id']))
        except BadRequest as error:
            self.send_json(error.status, {'detail': error.detail})
        except Exception as error:
            print(f'[collection] 錯誤：{type(error).__name__}: {error}')
            self.send_json(503, {'detail': '會員功能暫時無法使用'})
