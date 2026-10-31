-- 網站的資料表（PostgreSQL）：物種資料、AI 動物通的問答紀錄
-- 由 backend/db/import_species.py 執行；用 IF NOT EXISTS，重複執行不會出錯
--
-- 設計重點
--   1. 分類階層（綱→目→科→屬）放在 taxa，每一層用 parent_id 指向上一層；物種只記錄自己的「屬」
--   2. 一種動物有多筆的資料（照片、顏色、俗名、每月／各縣市紀錄數）各自獨立成表，以 species_id 關聯
--   3. 只能是固定幾種值的欄位用 CHECK 限制，錯誤的資料進不了資料庫
--   4. 子表的外鍵都設 ON DELETE CASCADE：刪掉一種動物時，它的照片、顏色等資料一起刪除

-- ---------- 類群：網站上的分頁（鳥類、蝴蝶、蛾…） ----------
CREATE TABLE IF NOT EXISTS animal_groups (
    code        text PRIMARY KEY,           -- 'aves'、'moth'…（和前端的 group 相同）
    name_zh     text NOT NULL,              -- 鳥類、蛾…
    category_zh text NOT NULL,              -- 上一層的大分類：昆蟲類、蛛形類…（鳥類等本身就是大分類）
    sort_order  smallint NOT NULL
);

-- ---------- 分類階層：自己連自己的樹狀結構 ----------
CREATE TABLE IF NOT EXISTS taxa (
    id        serial PRIMARY KEY,
    rank      text NOT NULL CHECK (rank IN ('class', 'order', 'suborder', 'infraorder', 'family', 'subfamily', 'genus')),
    name_sci  text NOT NULL,
    name_zh   text,
    parent_id integer REFERENCES taxa (id),  -- 上一層；綱（class）是最上層，沒有上一層
    UNIQUE (rank, name_sci)
);
CREATE INDEX IF NOT EXISTS taxa_parent_id_idx ON taxa (parent_id);

-- ---------- 物種 ----------
-- 主鍵用 iNaturalist 的物種編號：TaiCOL 編號有重複（同一個編號對到兩個學名），也有 200 多種沒有編號
CREATE TABLE IF NOT EXISTS species (
    id                 integer PRIMARY KEY,
    taicol_id          text,
    group_code         text NOT NULL REFERENCES animal_groups (code),
    genus_id           integer NOT NULL REFERENCES taxa (id),
    name_zh            text,                       -- 少數物種沒有中文名
    name_sci           text NOT NULL UNIQUE,
    name_en            text,
    is_endemic         boolean,                    -- 空值＝TaiCOL 沒有標註（不知道），和 false（不是特有種）不同
    is_domestic        boolean NOT NULL DEFAULT false,
    alien_type         text CHECK (alien_type IN ('native', 'naturalized', 'invasive', 'cultured')),
    protected_level    text CHECK (protected_level IN ('I', 'II', 'III')),
    redlist            text CHECK (redlist IN ('RE', 'NCR', 'NEN', 'NVU', 'NNT', 'NLC', 'DD', 'NA', 'NE')),
    observations_count integer NOT NULL DEFAULT 0 CHECK (observations_count >= 0),
    larva_count        integer CHECK (larva_count >= 0),  -- 幼蟲的紀錄數（只有蝶、蛾有）
    shape              text,                       -- 外型分類，例如「小型鳴禽（麻雀、白頭翁等）」
    size               smallint CHECK (size BETWEEN 1 AND 5),
    wikipedia_url      text
);
CREATE INDEX IF NOT EXISTS species_group_code_idx ON species (group_code);
CREATE INDEX IF NOT EXISTS species_genus_id_idx ON species (genus_id);

-- ---------- 照片：成體、幼蟲各最多一張 ----------
CREATE TABLE IF NOT EXISTS species_photos (
    species_id      integer NOT NULL REFERENCES species (id) ON DELETE CASCADE,
    kind            text NOT NULL CHECK (kind IN ('adult', 'larva')),
    url             text NOT NULL,
    author          text,
    license         text,
    observation_url text,
    PRIMARY KEY (species_id, kind)
);

-- ---------- 顏色：一種動物可以有好幾個顏色 ----------
CREATE TABLE IF NOT EXISTS species_colors (
    species_id integer NOT NULL REFERENCES species (id) ON DELETE CASCADE,
    color      text NOT NULL CHECK (color IN ('黑', '白', '灰', '褐', '紅', '橙', '黃', '綠', '藍')),
    PRIMARY KEY (species_id, color)
);
CREATE INDEX IF NOT EXISTS species_colors_color_idx ON species_colors (color);

-- ---------- 俗名 ----------
CREATE TABLE IF NOT EXISTS species_aliases (
    species_id integer NOT NULL REFERENCES species (id) ON DELETE CASCADE,
    alias      text NOT NULL,
    PRIMARY KEY (species_id, alias)
);
CREATE INDEX IF NOT EXISTS species_aliases_alias_idx ON species_aliases (alias);

-- ---------- 維基百科的文字段落 ----------
CREATE TABLE IF NOT EXISTS species_texts (
    species_id integer NOT NULL REFERENCES species (id) ON DELETE CASCADE,
    section    text NOT NULL CHECK (section IN ('summary', 'appearance', 'habitat', 'diet', 'behavior')),
    content    text NOT NULL,
    PRIMARY KEY (species_id, section)
);

-- ---------- 每月紀錄數：每種都存滿 12 個月（沒有紀錄的月份是 0） ----------
CREATE TABLE IF NOT EXISTS species_monthly_counts (
    species_id integer NOT NULL REFERENCES species (id) ON DELETE CASCADE,
    month      smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
    count      integer NOT NULL CHECK (count >= 0),
    PRIMARY KEY (species_id, month)
);

-- ---------- 縣市、各縣市紀錄數（只存有紀錄的縣市） ----------
CREATE TABLE IF NOT EXISTS counties (
    id   smallint PRIMARY KEY,
    name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS species_county_counts (
    species_id integer NOT NULL REFERENCES species (id) ON DELETE CASCADE,
    county_id  smallint NOT NULL REFERENCES counties (id),
    count      integer NOT NULL CHECK (count > 0),
    PRIMARY KEY (species_id, county_id)
);
-- 主鍵 (species_id, county_id) 只能從物種查縣市；「某縣市有哪些物種」要另外建從縣市開始的索引
CREATE INDEX IF NOT EXISTS species_county_counts_county_id_idx ON species_county_counts (county_id);

-- ==========================================================================
-- AI 動物通的問答紀錄（第 2 步）：分析熱門問題，也用來計算提問次數限制
-- ==========================================================================

-- 每一則被受理的提問一筆（超過次數被擋下的不記錄）
--   不存 IP：client_hash 是「IP＋當天日期」算出的代號，同一天能認出是同一位訪客（計算次數用），
--   隔天代號就完全不同，無法追蹤同一個人
CREATE TABLE IF NOT EXISTS ask_logs (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at    timestamptz NOT NULL DEFAULT now(),
    client_hash   text NOT NULL,
    question      text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 200),
    status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'error')),
    mode          text CHECK (mode IN ('ai', 'fallback')),  -- ai＝Claude 回答；fallback＝備援模式
    method        text,                                     -- 檢索方式：名稱查詢、向量搜尋…
    input_tokens  integer CHECK (input_tokens >= 0),
    output_tokens integer CHECK (output_tokens >= 0),
    duration_ms   integer CHECK (duration_ms >= 0)
);
-- 次數限制會查「這位訪客最近 1 分鐘／今天問了幾題」：先比對 client_hash，再看時間範圍
CREATE INDEX IF NOT EXISTS ask_logs_client_hash_created_at_idx ON ask_logs (client_hash, created_at);
-- 全站今天的總題數、每日統計：依時間範圍查
CREATE INDEX IF NOT EXISTS ask_logs_created_at_idx ON ask_logs (created_at);

-- 回答引用了哪些物種（一則回答可以引用好幾種）
CREATE TABLE IF NOT EXISTS ask_log_sources (
    log_id     bigint NOT NULL REFERENCES ask_logs (id) ON DELETE CASCADE,
    species_id integer NOT NULL REFERENCES species (id) ON DELETE CASCADE,
    position   smallint NOT NULL,  -- 在回答裡的順序（1 開始）
    PRIMARY KEY (log_id, species_id)
);
CREATE INDEX IF NOT EXISTS ask_log_sources_species_id_idx ON ask_log_sources (species_id);

-- ==========================================================================
-- AI 動物通的向量搜尋（第 3 步）：pgvector
-- ==========================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- RAG 的文字塊和向量：每種動物切成概要、食性、棲地、習性、外觀幾塊，名詞解釋各一塊
--   向量由 backend/build_index.py 算好（multilingual-e5-small，384 維，已正規化），backend/db/import_vectors.py 匯入
CREATE TABLE IF NOT EXISTS rag_chunks (
    id         text PRIMARY KEY,                                         -- 'species:5043#diet'
    doc_id     text NOT NULL,                                            -- 'species:5043'、'glossary:endemic'
    species_id integer REFERENCES species (id) ON DELETE CASCADE,        -- 名詞解釋沒有對應的物種
    group_code text NOT NULL,                                            -- 類群；名詞解釋是 'glossary'
    field      text NOT NULL CHECK (field IN ('overview', 'diet', 'habitat', 'behavior', 'appearance', 'glossary')),
    position   smallint NOT NULL,                                        -- 在文件裡的順序，1 是概要
    content    text NOT NULL,
    embedding  vector(384) NOT NULL
);
-- 名稱查詢時「取某幾種動物的全部塊，依順序排好」
CREATE INDEX IF NOT EXISTS rag_chunks_doc_id_position_idx ON rag_chunks (doc_id, position);

-- ==========================================================================
-- 會員（第 4 步）：Google 登入、生命清單、收藏
-- ==========================================================================

-- 會員：只存 Google 提供的基本資料，沒有密碼（密碼由 Google 保管）
CREATE TABLE IF NOT EXISTS users (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    google_sub    text NOT NULL UNIQUE,      -- Google 帳號的固定編號（Email 可能會改，這個不會）
    email         text NOT NULL,
    display_name  text,
    avatar_url    text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz NOT NULL DEFAULT now()
);

-- 登入狀態：瀏覽器的 cookie 存一串隨機的 token，資料庫只存它的 SHA-256
--   就算資料庫外洩，拿到的雜湊也不能拿來登入；登出時刪掉這一筆，token 立刻失效
CREATE TABLE IF NOT EXISTS sessions (
    token_hash text PRIMARY KEY,
    user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);

-- 生命清單（seen：在野外看過）和收藏（favorite）：同一種動物可以同時在兩個清單裡
CREATE TABLE IF NOT EXISTS user_species (
    user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    species_id integer NOT NULL REFERENCES species (id) ON DELETE CASCADE,
    list       text NOT NULL CHECK (list IN ('seen', 'favorite')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, list, species_id)
);
