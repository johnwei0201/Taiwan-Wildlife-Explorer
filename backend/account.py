"""
會員功能的資料庫操作（users、sessions、user_species，結構見 backend/db/schema.sql）

  login(google_user)         → 建立或更新會員、建立登入狀態，回傳 (會員, session token)
  current_user(token)        → 由 cookie 裡的 token 找出會員；沒登入或已過期回傳 None
  logout(token)              → 刪除這個登入狀態
  delete_user(user_id)       → 刪除會員；登入狀態、清單因為 ON DELETE CASCADE 一起刪除
  collection(user_id)        → 生命清單、收藏，以及各類群的完成度
  add / remove(...)          → 加入、移出清單
"""

import hashlib
import secrets

from database import run

SESSION_DAYS = 30
LISTS = ('seen', 'favorite')


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def user_dict(row):
    user_id, email, name, avatar = row
    return {'id': user_id, 'email': email, 'name': name, 'avatar': avatar}


def login(google_user):
    token = secrets.token_urlsafe(32)  # 256 位元的隨機字串，猜不到

    def work(cursor):
        # upsert：第一次登入就新增會員；之後登入更新名稱、頭像（使用者可能在 Google 改過）
        cursor.execute(
            """
            INSERT INTO users (google_sub, email, display_name, avatar_url) VALUES (%s, %s, %s, %s)
            ON CONFLICT (google_sub) DO UPDATE
              SET email = EXCLUDED.email, display_name = EXCLUDED.display_name,
                  avatar_url = EXCLUDED.avatar_url, last_login_at = now()
            RETURNING id, email, display_name, avatar_url
            """,
            (google_user['sub'], google_user['email'], google_user['name'], google_user['picture']),
        )
        user = user_dict(cursor.fetchone())
        cursor.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, now() + %s * interval '1 day')",
            (hash_token(token), user['id'], SESSION_DAYS),
        )
        # 順便清掉這位會員已經過期的登入狀態
        cursor.execute('DELETE FROM sessions WHERE user_id = %s AND expires_at < now()', (user['id'],))
        return user

    return run(work, transaction=True), token


def current_user(token):
    if not token:
        return None

    def work(cursor):
        cursor.execute(
            """
            SELECT u.id, u.email, u.display_name, u.avatar_url
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = %s AND s.expires_at > now()
            """,
            (hash_token(token),),
        )
        return cursor.fetchone()

    row = run(work)
    return user_dict(row) if row else None


def logout(token):
    def work(cursor):
        cursor.execute('DELETE FROM sessions WHERE token_hash = %s', (hash_token(token),))

    run(work)


def delete_user(user_id):
    def work(cursor):
        cursor.execute('DELETE FROM users WHERE id = %s', (user_id,))

    run(work)


def collection(user_id):
    def work(cursor):
        cursor.execute(
            'SELECT list, species_id FROM user_species WHERE user_id = %s ORDER BY created_at DESC', (user_id,),
        )
        lists = {name: [] for name in LISTS}
        for list_name, species_id in cursor.fetchall():
            lists[list_name].append(species_id)

        # 生命清單的完成度：每個類群「看過幾種／共幾種」，特有種另外算
        #   LEFT JOIN：沒看過的物種也要留著，才算得出「共幾種」
        cursor.execute(
            """
            SELECT g.code, g.name_zh,
                   count(us.species_id)                             AS seen,
                   count(*)                                         AS total,
                   count(us.species_id) FILTER (WHERE s.is_endemic) AS endemic_seen,
                   count(*) FILTER (WHERE s.is_endemic)             AS endemic_total
            FROM species s
            JOIN animal_groups g ON g.code = s.group_code
            LEFT JOIN user_species us ON us.species_id = s.id AND us.user_id = %s AND us.list = 'seen'
            GROUP BY g.code, g.name_zh, g.sort_order
            ORDER BY g.sort_order
            """,
            (user_id,),
        )
        groups = [
            {'code': code, 'name': name, 'seen': seen, 'total': total, 'endemicSeen': e_seen, 'endemicTotal': e_total}
            for code, name, seen, total, e_seen, e_total in cursor.fetchall()
        ]
        return {**lists, 'groups': groups}

    return run(work)


def add(user_id, species_id, list_name):
    """加入清單；已經在清單裡就不動作。物種不存在時回傳 False"""
    def work(cursor):
        # INSERT ... SELECT：物種存在才會寫入，不用先查一次；ON CONFLICT 處理重複按的情況
        cursor.execute(
            """
            INSERT INTO user_species (user_id, species_id, list)
            SELECT %s, id, %s FROM species WHERE id = %s
            ON CONFLICT DO NOTHING
            """,
            (user_id, list_name, species_id),
        )
        cursor.execute('SELECT 1 FROM species WHERE id = %s', (species_id,))
        return cursor.fetchone() is not None

    return run(work, transaction=True)


def remove(user_id, species_id, list_name):
    def work(cursor):
        cursor.execute(
            'DELETE FROM user_species WHERE user_id = %s AND species_id = %s AND list = %s',
            (user_id, species_id, list_name),
        )

    run(work)
