"""
把網站的物種資料（public/data/*.json）匯入 PostgreSQL

使用方式（在專案資料夾執行；需要 backend/.env 裡的 DATABASE_URL）：
  backend/.venv/Scripts/python backend/db/import_species.py

可以重複執行：
  - 整個匯入包在一個交易（transaction）裡，中途出錯就全部取消，不會只匯入一半
  - 類群、縣市、分類階層、物種用 upsert（有就更新、沒有就新增）
  - 照片、顏色等子表先清空再重新寫入，網站資料改了也會同步
"""

import json
import os
import sys
import time
from pathlib import Path

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / 'public' / 'data'
SCHEMA_FILE = Path(__file__).resolve().parent / 'schema.sql'

# 類群：代碼、中文名、上一層的大分類（和 src/constants/groups.js 一致），陣列順序就是網站上的順序
GROUPS = [
    ('aves', '鳥類', '鳥類'),
    ('mammalia', '哺乳類', '哺乳類'),
    ('reptilia', '爬蟲類', '爬蟲類'),
    ('amphibia', '兩棲類', '兩棲類'),
    ('fish', '魚類', '魚類'),
    ('lepidoptera', '蝴蝶', '昆蟲類'),
    ('moth', '蛾', '昆蟲類'),
    ('odonata', '蜻蜓', '昆蟲類'),
    ('coleoptera', '甲蟲', '昆蟲類'),
    ('hemiptera', '蟬、椿象', '昆蟲類'),
    ('orthoptera', '蚱蜢、蟋蟀', '昆蟲類'),
    ('mantodea', '螳螂', '昆蟲類'),
    ('phasmida', '竹節蟲', '昆蟲類'),
    ('diptera', '蒼蠅、蚊子', '昆蟲類'),
    ('hymenoptera', '蜂、螞蟻', '昆蟲類'),
    ('araneae', '蜘蛛', '蛛形類'),
    ('arachnid_other', '蠍子、盲蛛、蟎等', '蛛形類'),
    ('myriapoda', '蜈蚣、馬陸', '多足類'),
    ('crustacea', '甲殼類', '甲殼類'),
    ('domestic', '家養動物', '家養動物'),
]

# 分類階層由上到下的順序；物種資料裡沒有的層級（例如很多物種沒有亞目）就跳過，直接接到更上一層
RANKS = ['class', 'order', 'suborder', 'infraorder', 'family', 'subfamily', 'genus']

TEXT_SECTIONS = ['appearance', 'habitat', 'diet', 'behavior']


def load_json(name):
    return json.loads((DATA_DIR / name).read_text(encoding='utf-8'))


def build_taxa(species_list):
    """整理出所有分類階層：{(rank, 學名): (中文名, 上一層的 (rank, 學名))}"""
    taxa = {}
    for s in species_list:
        parent = None
        for rank in RANKS:
            taxon = s.get(rank)
            if not taxon:
                continue
            key = (rank, taxon['nameSci'])
            taxa.setdefault(key, (taxon.get('nameZh'), parent))
            parent = key
    return taxa


def import_taxa(cur, taxa):
    """由上往下一層一層寫入，寫下一層時，上一層的 id 已經存在；回傳 {(rank, 學名): id}"""
    ids = {}
    for rank in RANKS:
        rows = [
            (rank, name_sci, name_zh, ids[parent] if parent else None)
            for (r, name_sci), (name_zh, parent) in taxa.items()
            if r == rank
        ]
        cur.executemany(
            """
            INSERT INTO taxa (rank, name_sci, name_zh, parent_id) VALUES (%s, %s, %s, %s)
            ON CONFLICT (rank, name_sci) DO UPDATE SET name_zh = EXCLUDED.name_zh, parent_id = EXCLUDED.parent_id
            """,
            rows,
        )
        cur.execute('SELECT name_sci, id FROM taxa WHERE rank = %s', (rank,))
        ids.update({(rank, name_sci): taxon_id for name_sci, taxon_id in cur.fetchall()})
    return ids


def copy_rows(cur, table, columns, rows):
    """用 COPY 大量寫入：比一筆一筆 INSERT 快很多，適合幾萬筆的子表"""
    with cur.copy(f'COPY {table} ({", ".join(columns)}) FROM STDIN') as copy:
        for row in rows:
            copy.write_row(row)
    return len(rows)


def main():
    # Windows 終端機預設編碼是 cp950，印出部分中文字會出錯，固定用 UTF-8
    sys.stdout.reconfigure(encoding='utf-8')
    load_dotenv(ROOT / 'backend' / '.env')
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        sys.exit('找不到 DATABASE_URL：請在 backend/.env 加上資料庫的連線字串')

    species_list = load_json('species-list.json')
    details = load_json('species-details.json')
    ecology = load_json('species-ecology.json')['species']
    summaries = load_json('species-summaries.json')['species']
    started = time.time()

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        # with 區塊結束時才 commit；中間任何一步出錯，整個交易會 rollback
        cur.execute(SCHEMA_FILE.read_text(encoding='utf-8'))

        cur.executemany(
            """
            INSERT INTO animal_groups (code, name_zh, category_zh, sort_order) VALUES (%s, %s, %s, %s)
            ON CONFLICT (code) DO UPDATE
              SET name_zh = EXCLUDED.name_zh, category_zh = EXCLUDED.category_zh, sort_order = EXCLUDED.sort_order
            """,
            [(code, name_zh, category_zh, i) for i, (code, name_zh, category_zh) in enumerate(GROUPS, 1)],
        )

        county_ids = {name: i for i, name in enumerate(details['counties'], 1)}
        cur.executemany(
            'INSERT INTO counties (id, name) VALUES (%s, %s) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
            [(i, name) for name, i in county_ids.items()],
        )

        taxa = build_taxa(species_list)
        taxon_ids = import_taxa(cur, taxa)

        cur.executemany(
            """
            INSERT INTO species (id, taicol_id, group_code, genus_id, name_zh, name_sci, name_en, is_endemic,
                                 is_domestic, alien_type, protected_level, redlist, observations_count,
                                 larva_count, shape, size, wikipedia_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
              taicol_id = EXCLUDED.taicol_id, group_code = EXCLUDED.group_code, genus_id = EXCLUDED.genus_id,
              name_zh = EXCLUDED.name_zh, name_sci = EXCLUDED.name_sci, name_en = EXCLUDED.name_en,
              is_endemic = EXCLUDED.is_endemic, is_domestic = EXCLUDED.is_domestic,
              alien_type = EXCLUDED.alien_type, protected_level = EXCLUDED.protected_level,
              redlist = EXCLUDED.redlist, observations_count = EXCLUDED.observations_count,
              larva_count = EXCLUDED.larva_count, shape = EXCLUDED.shape, size = EXCLUDED.size,
              wikipedia_url = EXCLUDED.wikipedia_url
            """,
            [
                (
                    s['id'], s['taicolId'], s['group'], taxon_ids[('genus', s['genus']['nameSci'])],
                    s['nameZh'], s['nameSci'], s['nameEn'], s['endemic'], s.get('domestic', False),
                    s['alienType'], s['protectedLevel'], s['redlist'], s['observationsCount'],
                    s.get('larvaCount'), s['shape'], s['size'], summaries.get(str(s['id']), {}).get('url'),
                )
                for s in species_list
            ],
        )
        # 網站資料裡已經移除的物種，資料庫也刪掉（子表的資料會因為 ON DELETE CASCADE 一起刪除）
        cur.execute('DELETE FROM species WHERE NOT (id = ANY(%s))', ([s['id'] for s in species_list],))
        removed = cur.rowcount

        # 子表：先清空，再用 COPY 整批寫入
        cur.execute(
            'TRUNCATE species_photos, species_colors, species_aliases, species_texts, '
            'species_monthly_counts, species_county_counts'
        )
        counts = {}
        counts['species_photos'] = copy_rows(
            cur, 'species_photos', ['species_id', 'kind', 'url', 'author', 'license', 'observation_url'],
            [
                (s['id'], kind, photo['url'], photo.get('author'), photo.get('license'), photo.get('observationUrl'))
                for s in species_list
                for kind, photo in (('adult', s['photo']), ('larva', s.get('larvaPhoto')))
                if photo
            ],
        )
        counts['species_colors'] = copy_rows(
            cur, 'species_colors', ['species_id', 'color'],
            [(s['id'], color) for s in species_list for color in dict.fromkeys(s['colors'] or [])],
        )

        aliases = []
        for s in species_list:
            names = (ecology.get(str(s['id']), {}).get('aliases') or []) + (s.get('aliases') or [])
            # 去掉前後空白、重複的俗名，以及和正式中文名一樣的
            names = dict.fromkeys(n.strip() for n in names if n.strip() and n.strip() != s['nameZh'])
            aliases += [(s['id'], name) for name in names]
        counts['species_aliases'] = copy_rows(cur, 'species_aliases', ['species_id', 'alias'], aliases)

        texts = []
        for s in species_list:
            key = str(s['id'])
            if summaries.get(key, {}).get('summary'):
                texts.append((s['id'], 'summary', summaries[key]['summary']))
            texts += [
                (s['id'], section, ecology[key][section])
                for section in TEXT_SECTIONS
                if ecology.get(key, {}).get(section)
            ]
        counts['species_texts'] = copy_rows(cur, 'species_texts', ['species_id', 'section', 'content'], texts)

        counts['species_monthly_counts'] = copy_rows(
            cur, 'species_monthly_counts', ['species_id', 'month', 'count'],
            [
                (int(species_id), month, count)
                for species_id, detail in details['species'].items()
                for month, count in enumerate(detail['months'], 1)
            ],
        )
        counts['species_county_counts'] = copy_rows(
            cur, 'species_county_counts', ['species_id', 'county_id', 'count'],
            [
                (int(species_id), county_ids[county], count)
                for species_id, detail in details['species'].items()
                for county, count in detail['counties'].items()
                if count > 0
            ],
        )

    print(f'匯入完成（{time.time() - started:.1f} 秒）')
    print(f'  animal_groups：{len(GROUPS)} 筆')
    print(f'  counties：{len(county_ids)} 筆')
    print(f'  taxa：{len(taxa)} 筆')
    print(f'  species：{len(species_list)} 筆（刪除已移除的物種 {removed} 筆）')
    for table, n in counts.items():
        print(f'  {table}：{n} 筆')


if __name__ == '__main__':
    main()
