# 發現台灣動物趣 Taiwan Wildlife Explorer

認識臺灣野生動物的圖鑑網站：依分類瀏覽 3,560 種動物、查看身邊的動物紀錄，並可以用一句話問「AI 動物通」。

網站：https://taiwan-wildlife-explorer.vercel.app

## 功能

- **物種圖鑑**：鳥類、哺乳類、爬蟲類、兩棲類、魚類、昆蟲、蜘蛛等類群，可依特有種、保育等級、外型、顏色篩選；家養動物另有品種介紹
- **物種介紹**：分類階層、保育與紅皮書等級、照片、常見月份、出現縣市、iNaturalist 紀錄地圖
- **我附近的動物**：依目前位置顯示附近的觀察紀錄
- **AI 動物通**：用 RAG（檢索增強生成）回答動物問題，只根據本站資料回答，並附上參考的物種卡片

## AI 動物通（RAG）

```
問題 ──→ ① 名稱查詢：問題裡有物種名、俗名（帝雉、石虎、田雞仔…）→ 直接取該物種的資料
         ├→ ② 類群篩選：問的是鳥、蛙、蛇…（「吃魚的鳥」的魚是食物，不算）
         └→ ③ 向量搜尋：沒有名稱時，在該類群裡找意思最接近的段落
              ↓
         ④ Claude Haiku 5.5 只根據找到的資料回答（結構化輸出：回答、參考物種、延伸問題）
         ⑤ 沒有金鑰、額度用完或連線失敗 → 備援模式，只列出找到的物種
```

| 步驟 | 做法 |
|---|---|
| 資料 | 3,560 種動物：TaiCOL、iNaturalist（常見月份、縣市）、維基百科（簡介、食性、棲地、習性、外觀、俗名） |
| 切塊 | 每種切成概要、食性、棲地、習性、外觀，共 8,754 塊；每塊開頭帶物種名稱 |
| 向量 | `intfloat/multilingual-e5-small`（384 維）；文件向量事先算好（`backend/data/vectors.npy`） |
| 檢索 | 名稱索引 12,000 多個名稱（含俗名、英文名）＋ numpy 計算餘弦相似度 |
| 部署 | Vercel Python Function（`api/ask.py`），和網站同一個網域；和資料庫一樣放在新加坡 |

**為了放進 Vercel（Python 上限 500 MB）**：線上把問題轉向量改用同一個模型的 ONNX int8 量化版（onnxruntime，不需要 PyTorch，模型 470 → 118 MB），和原模型的向量相似度 0.996 以上（`backend/verify_onnx.py`）；向量搜尋不用向量資料庫，直接用 numpy 計算。

**測試（20 題）**：單一物種、兩種比較、俗名對到多種、名詞解釋、列舉型問題、無關問題、本站沒收錄的動物、提示注入、英文提問；平均一題約 0.0005 美元。已知限制：「住在高山的鳥」這類需要比較海拔的列舉題較弱；英文只認得本站收錄的英文名。

## 資料庫（PostgreSQL）

物種資料另外匯入 PostgreSQL（Neon），用在統計與查詢；網站瀏覽仍讀靜態 JSON，速度不受資料庫影響。

| 資料表 | 內容 |
|---|---|
| `species` | 3,560 種動物的名稱、特有種、保育等級、紅皮書、外來種類型 |
| `taxa` | 分類階層（綱→目→科→屬），`parent_id` 指向上一層，用 `WITH RECURSIVE` 查整條階層 |
| `animal_groups`、`counties` | 類群、縣市 |
| `species_photos`、`species_colors`、`species_aliases`、`species_texts` | 照片、顏色、俗名、維基段落（一對多） |
| `species_monthly_counts`、`species_county_counts` | 每月、各縣市的紀錄數 |

- 結構：[`backend/db/schema.sql`](backend/db/schema.sql)（外鍵、`CHECK` 限制、`ON DELETE CASCADE`、索引）
- 匯入：[`backend/db/import_species.py`](backend/db/import_species.py)，整個匯入在一個交易裡，用 upsert 和 `COPY`，可以重複執行
- 查詢範例：[`backend/db/example_queries.sql`](backend/db/example_queries.sql)（分組統計、`FILTER`、遞迴查詢、`EXISTS`）

**AI 動物通的問答紀錄**（`ask_logs`、`ask_log_sources`）：每則提問的問題、回答模式、token 用量、回應時間、引用的物種

- 次數限制改用資料庫計算（每分鐘 5 題、每天 50 題、全站每天 500 題）：Vercel 同時開多台主機時，所有主機看到同一份紀錄
- 同一位訪客同時送出多題時，用 `pg_advisory_xact_lock` 鎖住該訪客，檢查次數和寫入紀錄在同一個交易裡完成，不會多放行
- 不存 IP：訪客代號是「臺灣日期＋IP」的 HMAC，同一天能計算次數，隔天就無法對應到同一個人
- 資料庫連不上時，自動改用記憶體計算次數，AI 動物通照常回答
- 分析查詢：[`backend/db/ask_queries.sql`](backend/db/ask_queries.sql)（每日題數、熱門問題、最常被引用的物種、花費）

## 技術

- 前端：React 19、Vite、React Router、CSS Modules、Leaflet
- 資料處理：Node.js、Python（標準函式庫）
- AI 後端：Python、Claude API、onnxruntime、numpy；建立資料時用 sentence-transformers
- 資料庫：PostgreSQL（Neon）、psycopg

## 本機開發

```bash
npm install
npm run dev
```

AI 動物通的後端（需要 Python 3.12）：

```bash
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements.txt
backend/.venv/Scripts/python backend/serve_local.py
```

在 `backend/.env` 放 `ANTHROPIC_API_KEY=…`（不會上傳）；沒有金鑰時以備援模式回答。`npm run dev` 會把 `/api` 轉給本機的後端。

更新 AI 用的資料：

```bash
backend/.venv/Scripts/python backend/build_documents.py   # 物種資料 → 文件、塊、名稱索引
backend/.venv/Scripts/python backend/build_index.py       # 塊 → 向量（只重新轉有變動的塊）
backend/.venv/Scripts/python backend/ask.py               # 20 題測試（會呼叫 Claude）
```

匯入資料庫（需要 `backend/.env` 裡的 `DATABASE_URL`）：

```bash
backend/.venv/Scripts/python backend/db/import_species.py  # 建立資料表並匯入物種資料
backend/.venv/Scripts/python backend/db/run_queries.py     # 執行查詢範例
```

## 資料來源

iNaturalist、TaiCOL 臺灣物種名錄、Wikidata、維基百科、OpenStreetMap。照片版權屬於各攝影者，依各自的 CC 授權條款使用。
