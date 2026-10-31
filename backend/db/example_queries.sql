-- 物種資料庫的查詢範例
-- 執行：backend/.venv/Scripts/python backend/db/run_queries.py
-- 每個查詢前面的「-- 標題」會印在結果上方

-- 各類群的物種數、特有種、保育類（依網站上的順序）
SELECT g.name_zh                                       AS 類群,
       count(*)                                        AS 物種數,
       count(*) FILTER (WHERE s.is_endemic)            AS 特有種,
       count(*) FILTER (WHERE s.protected_level IS NOT NULL) AS 保育類
FROM species s
JOIN animal_groups g ON g.code = s.group_code
GROUP BY g.code, g.name_zh, g.sort_order
ORDER BY g.sort_order;

-- 臺北市紀錄最多的 10 種鳥
SELECT s.name_zh AS 物種, cc.count AS 臺北市紀錄數
FROM species_county_counts cc
JOIN counties c ON c.id = cc.county_id
JOIN species s  ON s.id = cc.species_id
WHERE c.name = '臺北市' AND s.group_code = 'aves'
ORDER BY cc.count DESC
LIMIT 10;

-- 冬天（12～2 月）特別常見的鳥：冬天的紀錄占全年 6 成以上，且全年至少 300 筆
SELECT s.name_zh AS 物種,
       sum(m.count) FILTER (WHERE m.month IN (12, 1, 2)) AS 冬天紀錄數,
       sum(m.count)                                     AS 全年紀錄數,
       round(100.0 * sum(m.count) FILTER (WHERE m.month IN (12, 1, 2)) / sum(m.count)) AS 冬天占比
FROM species s
JOIN species_monthly_counts m ON m.species_id = s.id
WHERE s.group_code = 'aves'
GROUP BY s.id, s.name_zh
HAVING sum(m.count) >= 300
   AND sum(m.count) FILTER (WHERE m.month IN (12, 1, 2)) >= 0.6 * sum(m.count)
ORDER BY 冬天占比 DESC
LIMIT 10;

-- 遞迴查詢：黑冠麻鷺從「屬」往上到「綱」的完整分類階層
WITH RECURSIVE lineage AS (
    SELECT t.id, t.rank, t.name_zh, t.name_sci, t.parent_id, 1 AS depth
    FROM species s
    JOIN taxa t ON t.id = s.genus_id
    WHERE s.name_zh = '黑冠麻鷺'
  UNION ALL
    SELECT p.id, p.rank, p.name_zh, p.name_sci, p.parent_id, l.depth + 1
    FROM lineage l
    JOIN taxa p ON p.id = l.parent_id
)
SELECT rank AS 層級, name_zh AS 中文名, name_sci AS 學名
FROM lineage
ORDER BY depth DESC;

-- 遞迴查詢：「鷺科」底下（包含亞科）各屬有幾種
WITH RECURSIVE descendants AS (
    SELECT id, rank, name_zh FROM taxa WHERE rank = 'family' AND name_zh = '鷺科'
  UNION ALL
    SELECT c.id, c.rank, c.name_zh
    FROM taxa c
    JOIN descendants d ON c.parent_id = d.id
)
SELECT d.name_zh AS 屬, count(s.id) AS 物種數
FROM descendants d
JOIN species s ON s.genus_id = d.id
WHERE d.rank = 'genus'
GROUP BY d.id, d.name_zh
ORDER BY 物種數 DESC, 屬;

-- 用俗名找物種：「暗光鳥」是哪些鳥（LIKE 部分比對）
SELECT s.name_zh AS 物種, string_agg(a.alias, '、' ORDER BY a.alias) AS 符合的俗名
FROM species_aliases a
JOIN species s ON s.id = a.species_id
WHERE a.alias LIKE '%暗光鳥%'
GROUP BY s.id, s.name_zh;

-- 黑色又有黃色的特有種
SELECT s.name_zh AS 物種, g.name_zh AS 類群
FROM species s
JOIN animal_groups g ON g.code = s.group_code
WHERE s.is_endemic
  AND EXISTS (SELECT 1 FROM species_colors c WHERE c.species_id = s.id AND c.color = '黑')
  AND EXISTS (SELECT 1 FROM species_colors c WHERE c.species_id = s.id AND c.color = '黃')
ORDER BY s.observations_count DESC
LIMIT 10;
