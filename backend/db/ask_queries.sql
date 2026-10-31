-- AI 動物通問答紀錄的分析查詢
-- 執行：backend/.venv/Scripts/python backend/db/run_queries.py backend/db/ask_queries.sql

-- 最近 14 天每天的提問數、AI 回答和備援的比例（以臺灣時間分日）
SELECT (created_at AT TIME ZONE 'Asia/Taipei')::date        AS 日期,
       count(*)                                             AS 提問數,
       count(*) FILTER (WHERE mode = 'ai')                  AS "AI回答",
       count(*) FILTER (WHERE mode = 'fallback')            AS 備援,
       count(*) FILTER (WHERE status = 'error')             AS 錯誤,
       count(DISTINCT client_hash)                          AS 訪客數
FROM ask_logs
WHERE created_at >= now() - interval '14 days'
GROUP BY 1
ORDER BY 1 DESC;

-- 熱門問題：去掉前後空白和問號後，同樣的問題算在一起
SELECT regexp_replace(trim(question), '[？?]+$', '') AS 問題, count(*) AS 次數
FROM ask_logs
GROUP BY 1
ORDER BY 次數 DESC, 問題
LIMIT 20;

-- 最常被回答引用的物種
SELECT s.name_zh AS 物種, g.name_zh AS 類群, count(*) AS 被引用次數
FROM ask_log_sources a
JOIN species s       ON s.id = a.species_id
JOIN animal_groups g ON g.code = s.group_code
GROUP BY s.id, s.name_zh, g.name_zh
ORDER BY 被引用次數 DESC
LIMIT 20;

-- 各檢索方式的題數、平均回應時間、平均花費（Haiku 5.5：輸入 0.10、輸出 0.50 美元／百萬 token）
SELECT method                                        AS 檢索方式,
       count(*)                                      AS 題數,
       round(avg(duration_ms))                       AS 平均毫秒,
       round(avg(input_tokens * 0.10 + output_tokens * 0.50) / 1e6, 6) AS 平均美元
FROM ask_logs
WHERE status = 'answered'
GROUP BY method
ORDER BY 題數 DESC;

-- 找不到資料的問題：AI 回答了但沒有引用任何物種（可能是本站沒收錄、或檢索沒找到，值得檢查）
SELECT l.created_at AT TIME ZONE 'Asia/Taipei' AS 時間, l.question AS 問題, l.method AS 檢索方式
FROM ask_logs l
WHERE l.status = 'answered'
  AND NOT EXISTS (SELECT 1 FROM ask_log_sources a WHERE a.log_id = l.id)
ORDER BY l.created_at DESC
LIMIT 20;

-- 累計花費
SELECT count(*)                                                        AS "AI回答題數",
       round(sum(input_tokens * 0.10 + output_tokens * 0.50) / 1e6, 4) AS 累計美元
FROM ask_logs
WHERE mode = 'ai';
