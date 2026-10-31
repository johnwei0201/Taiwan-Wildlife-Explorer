# 發現台灣動物趣 Taiwan Wildlife Explorer

認識臺灣野生動物的圖鑑網站：依分類瀏覽 3,560 種動物、查看身邊的動物紀錄，並可以用一句話問「AI 動物通」。

網站：https://taiwan-wildlife-explorer.vercel.app

## 功能

- **物種圖鑑**：鳥類、哺乳類、爬蟲類、兩棲類、魚類、昆蟲、蜘蛛等類群，可依特有種、保育等級、外型、顏色篩選；家養動物另有品種介紹
- **物種介紹**：分類階層、保育與紅皮書等級、照片、常見月份、出現縣市、iNaturalist 紀錄地圖
- **我附近的動物**：依目前位置顯示附近的觀察紀錄
- **AI 動物通**：用 RAG（檢索增強生成）回答動物問題，只根據本站資料回答，並附上參考的物種卡片
- **會員（生命清單）**：用 Google 帳號登入，記錄在野外看過的動物，看各類群、特有種的完成度；也可以收藏喜歡的動物

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
| 向量 | `intfloat/multilingual-e5-small`（384 維）；文件向量事先算好，存在 PostgreSQL 的 `rag_chunks`（pgvector） |
| 檢索 | 名稱索引 12,000 多個名稱（含俗名、英文名）＋ pgvector 用 SQL 計算餘弦距離（`<=>`） |
| 部署 | Vercel Python Function（`api/ask.py`），和網站同一個網域；和資料庫一樣放在新加坡 |

**為了放進 Vercel（Python 函式上限 225 MB）**：線上把問題轉向量改用同一個模型的 ONNX int8 量化版（onnxruntime，不需要 PyTorch），和原模型的向量相似度 0.996 以上（`backend/verify_onnx.py`）；向量放在資料庫，函式不用帶 19 MB 的向量檔。

**pgvector 的向量搜尋**：一段 SQL 完成「找最接近的 40 塊 → 每種動物留最接近的一塊（`DISTINCT ON`）→ 取前 5 種 → 附上概要」。

- 不建 HNSW 索引：實測 8,754 塊逐筆比對 6～14 毫秒；HNSW 不到 1 毫秒，但前 40 名只有 33 筆和精確結果相同，加上類群篩選時還會少回傳（要開 `hnsw.iterative_scan`）。這個資料量下精確搜尋比較划算
- 改用 pgvector 前後的檢索結果，110 題完全相同（`backend/verify_pgvector.py`，和原本的 numpy 版逐題比對）
- 只讀取的查詢不開交易：pg8000 每開一次交易要多送 `BEGIN`、`COMMIT`，一次查詢從約 430 毫秒降到約 90 毫秒（從臺灣連線測量）

**測試（20 題）**：單一物種、兩種比較、俗名對到多種、名詞解釋、列舉型問題、無關問題、本站沒收錄的動物、提示注入、英文提問；平均一題約 0.0005 美元。已知限制：「住在高山的鳥」這類需要比較海拔的列舉題較弱；英文只認得本站收錄的英文名。

## 資料庫（PostgreSQL）

物種資料、AI 動物通的向量和問答紀錄放在 PostgreSQL（Neon，新加坡）；網站瀏覽仍讀靜態 JSON，速度不受資料庫影響。

| 資料表 | 內容 |
|---|---|
| `species` | 3,560 種動物的名稱、特有種、保育等級、紅皮書、外來種類型 |
| `taxa` | 分類階層（綱→目→科→屬），`parent_id` 指向上一層，用 `WITH RECURSIVE` 查整條階層 |
| `animal_groups`、`counties` | 類群、縣市 |
| `species_photos`、`species_colors`、`species_aliases`、`species_texts` | 照片、顏色、俗名、維基段落（一對多） |
| `species_monthly_counts`、`species_county_counts` | 每月、各縣市的紀錄數 |
| `rag_chunks` | AI 動物通的 8,754 塊文字和 384 維向量（pgvector） |
| `ask_logs`、`ask_log_sources` | AI 動物通的問答紀錄、回答引用的物種 |
| `users`、`sessions`、`user_species` | 會員、登入狀態、生命清單和收藏 |

- 結構：[`backend/db/schema.sql`](backend/db/schema.sql)（外鍵、`CHECK` 限制、`ON DELETE CASCADE`、索引）
- 匯入：[`backend/db/import_species.py`](backend/db/import_species.py)，整個匯入在一個交易裡，用 upsert 和 `COPY`，可以重複執行
- 查詢範例：[`backend/db/example_queries.sql`](backend/db/example_queries.sql)（分組統計、`FILTER`、遞迴查詢、`EXISTS`）

**AI 動物通的問答紀錄**（`ask_logs`、`ask_log_sources`）：每則提問的問題、回答模式、token 用量、回應時間、引用的物種

- 次數限制改用資料庫計算（每分鐘 5 題、每天 50 題、全站每天 500 題）：Vercel 同時開多台主機時，所有主機看到同一份紀錄
- 同一位訪客同時送出多題時，用 `pg_advisory_xact_lock` 鎖住該訪客，檢查次數和寫入紀錄在同一個交易裡完成，不會多放行
- 不存 IP：訪客代號是「臺灣日期＋IP」的 HMAC，同一天能計算次數，隔天就無法對應到同一個人
- 資料庫連不上時，自動改用記憶體計算次數，AI 動物通照常回答
- 分析查詢：[`backend/db/ask_queries.sql`](backend/db/ask_queries.sql)（每日題數、熱門問題、最常被引用的物種、花費）

## 會員（Google 登入）

1. 前端用 Google Identity Services 的登入按鈕，登入後拿到 Google 簽名的 ID token（JWT）
2. 後端（[`api/auth.py`](api/auth.py)）驗證 token，建立自己的登入狀態，存在 `sessions` 表；瀏覽器只拿到 HttpOnly cookie
3. 生命清單的完成度用一段 SQL 算出：`LEFT JOIN` 保留沒看過的物種，`FILTER` 另外算特有種（[`backend/account.py`](backend/account.py)）

安全性的做法：

- **JWT 驗證自己寫**（[`backend/google_token.py`](backend/google_token.py)）：Google 的 google-auth 套件連同依賴約 27 MB，會讓 Vercel 函式超過 225 MB 的上限；RS256 驗證只用 Python 內建的 `pow` 和 SHA-256，用「組出預期內容再整段比對」的方式，避開解析簽章的已知漏洞。檢查發行者、對象（aud）、過期時間、Email 已驗證，只接受 RS256
- **測試**（[`backend/test_google_token.py`](backend/test_google_token.py)）：用自己產生的 RSA 金鑰簽 token，9 種情況（竄改內容、別的金鑰、別的網站、過期、`alg: none`…）都符合預期
- **登入狀態**：cookie 是 256 位元的隨機字串，設 `HttpOnly`、`Secure`、`SameSite=Lax`；資料庫只存它的 SHA-256，外洩也不能拿來登入；登出時刪除該筆，立刻失效
- **CSRF**：除了 `SameSite=Lax`，會修改資料的請求還會比對 `Origin` 和網址
- **不存密碼**：只存 Google 提供的名稱、Email、頭像；刪除帳號時，`ON DELETE CASCADE` 一併刪除登入狀態和清單

## 技術

- 前端：React 19、Vite、React Router、CSS Modules、Leaflet
- 資料處理：Node.js、Python（標準函式庫）
- AI 後端：Python、Claude API、onnxruntime、pgvector；建立資料時用 sentence-transformers
- 資料庫：PostgreSQL（Neon）；線上用 pg8000（純 Python，Vercel 函式有 225 MB 上限），本機匯入用 psycopg（支援 COPY）

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

在 `backend/.env` 放 `ANTHROPIC_API_KEY=…`、`DATABASE_URL=…`（不會上傳），會員功能另外需要 `GOOGLE_CLIENT_ID=…`；沒有 Claude 金鑰時以備援模式回答，沒有 Client ID 時會員頁顯示「準備中」。`npm run dev` 會把 `/api` 轉給本機的後端。

更新 AI 用的資料：

```bash
backend/.venv/Scripts/python backend/build_documents.py   # 物種資料 → 文件、塊、名稱索引
backend/.venv/Scripts/python backend/build_index.py       # 塊 → 向量（只重新轉有變動的塊）
backend/.venv/Scripts/python backend/db/import_vectors.py # 塊和向量 → PostgreSQL（pgvector）
backend/.venv/Scripts/python backend/ask.py               # 20 題測試（會呼叫 Claude）
```

匯入資料庫（需要 `backend/.env` 裡的 `DATABASE_URL`）：

```bash
backend/.venv/Scripts/python backend/db/import_species.py  # 建立資料表並匯入物種資料
backend/.venv/Scripts/python backend/db/run_queries.py     # 執行查詢範例
```

## 資料來源

iNaturalist、TaiCOL 臺灣物種名錄、Wikidata、維基百科、OpenStreetMap。照片版權屬於各攝影者，依各自的 CC 授權條款使用。
