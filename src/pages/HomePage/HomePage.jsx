import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SpeciesGrid from '../../components/SpeciesGrid/SpeciesGrid.jsx'
import FilterPanel from '../../components/FilterPanel/FilterPanel.jsx'
import { COLLECTIONS, GROUPS, findGroup, matchTags, parseTags } from '../../constants/groups.js'
import { FILTERS, applyFilters } from '../../constants/filters.js'
import { useSpeciesList } from '../../hooks/useSpeciesList.js'
import { matchQuery, parseQuery, searchText } from '../../utils/search.js'
import styles from './HomePage.module.css'

const RANDOM_COUNT = 30

// 首頁隨機推薦不放昆蟲類、蛛形類、多足類、爬蟲類：有些人看到蟲、蜘蛛、蜈蚣或蛇的照片會不舒服，
// 一打開網頁就看到可能直接離開；想看的人點對應的分頁就看得到
const RANDOM_EXCLUDED_IDS = ['insecta', 'arachnida', 'myriapoda', 'reptilia']
const RANDOM_GROUPS = GROUPS.filter((g) => g.kind === 'group' && !RANDOM_EXCLUDED_IDS.includes(g.id))

// 類群裡再排除部分分類（目或科的學名）：
//   老鼠和長得像老鼠的：鼠科、倉鼠科（田鼠）、尖鼠科（鼩鼱）
//   蝙蝠：翼手目，包含蝙蝠科、葉鼻蝠科等所有蝙蝠
const RANDOM_EXCLUDED_TAXA = ['Muridae', 'Cricetidae', 'Soricidae', 'Chiroptera']
const isRandomCandidate = (s) =>
  s.photo && !RANDOM_EXCLUDED_TAXA.includes(s.order?.nameSci) && !RANDOM_EXCLUDED_TAXA.includes(s.family?.nameSci)

// 洗牌（Fisher–Yates）：從最後一張開始，每張都和前面隨機一張交換，每種排列機率相同
function shuffle(list) {
  const result = [...list]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// 各類群平均挑選：直接從全部物種隨機挑，鳥類佔一半以上，推薦幾乎都是鳥；
// 改成每個類群輪流各拿一種，直到湊滿 30 種（某類群挑完了就跳過它），最後再整體洗牌
function pickBalanced(speciesList, count) {
  const pools = RANDOM_GROUPS.map((g) => shuffle(speciesList.filter((s) => isRandomCandidate(s) && g.match(s))))
  const picked = []
  while (picked.length < count && pools.some((pool) => pool.length > 0)) {
    for (const pool of shuffle(pools)) {
      if (picked.length >= count) break
      if (pool.length > 0) picked.push(pool.pop())
    }
  }
  return shuffle(picked)
}

export default function HomePage() {
  const { speciesList, status } = useSpeciesList()

  // 分頁與篩選條件存在網址上（例如 /?group=insecta&sub=lepidoptera&tag=endemic&color=藍）：
  // 點進物種詳細頁再按「上一頁」回來，條件還會保留
  const [searchParams, setSearchParams] = useSearchParams()
  const groupParam = searchParams.get('group')
  // 主題可複選；舊網址（例如 /?group=endemic）把主題放在 group，也一併讀進來
  const activeTags = [...new Set([...parseTags(searchParams.get('tag')), ...parseTags(groupParam)])]
  const found = findGroup(groupParam, searchParams.get('sub'))
  // 搜尋字也存在網址上（q），點進詳細頁再回來，搜尋結果還在
  const queryParam = searchParams.get('q') ?? ''
  const queryTerms = parseQuery(queryParam)
  // activeGroup 為 null＝還沒選，顯示隨機推薦；只選了主題或有搜尋字時，範圍是「全部」
  const activeGroup = found.group ?? (activeTags.length > 0 || queryTerms.length > 0 ? GROUPS[0] : null)
  const activeSub = found.subgroup // null＝第二層選「全部」
  const filters = Object.fromEntries(FILTERS.map((f) => [f.key, searchParams.get(f.key) ?? '']))

  // 手機上第二層放不下會橫向捲動：把選取的小分類捲進畫面，避免「選了卻看不到」
  // 只在第二層容器內左右捲動，不動到整個頁面的上下位置
  const subtabsRef = useRef(null)
  useEffect(() => {
    const container = subtabsRef.current
    const selected = container?.querySelector('[aria-selected="true"]')
    if (!selected) return
    const box = container.getBoundingClientRect()
    const item = selected.getBoundingClientRect()
    if (item.left < box.left || item.right > box.right) {
      // 讓選取的按鈕停在容器中間
      container.scrollLeft += item.left + item.width / 2 - (box.left + box.width / 2)
    }
  }, [activeGroup?.id, activeSub?.id])

  // 一打開網頁先隨機推薦 30 種（各類群平均、只挑有照片的），每次重新整理都不一樣
  // 按「推薦」按鈕時把 refreshCount 加 1，useMemo 就會重新洗牌，不用重新載入整個網頁
  const [refreshCount, setRefreshCount] = useState(0)
  const randomSpecies = useMemo(
    () => pickBalanced(speciesList, RANDOM_COUNT),
    [speciesList, refreshCount],
  )

  // 搜尋框在頁首（SearchBox），這裡只負責依網址上的搜尋字篩選
  // 每個物種可以被搜尋到的文字（中文名、學名、科、目…），資料載入後算一次就好
  const searchTexts = useMemo(() => new Map(speciesList.map((s) => [s.id, searchText(s)])), [speciesList])
  const matchSearch = (s) => matchQuery(searchTexts.get(s.id), queryTerms)

  // 組出網址參數：分頁、小分類、主題、搜尋字（外觀篩選另外加）
  const buildParams = (groupId, subId, tags) => {
    const params = { group: groupId }
    if (subId) params.sub = subId
    if (tags.length > 0) params.tag = tags.join(',')
    if (queryParam.trim()) params.q = queryParam
    return params
  }

  // 切換分頁時清空外觀篩選（不同類群的選項不一樣），但保留主題和搜尋字：它們跨類群都適用
  const selectGroup = (groupId) => setSearchParams(buildParams(groupId, null, activeTags))
  const selectSub = (subId) => setSearchParams(buildParams(activeGroup.id, subId, activeTags))

  // 點主題：選取／取消，外觀篩選保留
  const toggleTag = (tagId) => {
    const tags = activeTags.includes(tagId) ? activeTags.filter((t) => t !== tagId) : [...activeTags, tagId]
    const next = buildParams(activeGroup?.id ?? 'all', activeSub?.id, tags)
    for (const [key, value] of Object.entries(filters)) if (value) next[key] = value
    setSearchParams(next, { replace: true })
  }

  const changeFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    // replace：調整篩選不新增瀏覽紀錄，按「上一頁」不會一格一格退回去
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => setSearchParams(buildParams(activeGroup.id, activeSub?.id, activeTags), { replace: true })

  const showFilters = activeGroup?.kind === 'group'
  const applyAppearance = (list) => (showFilters ? applyFilters(list, filters) : list)

  // 篩選順序：分頁（有選第二層就用第二層，例如「昆蟲類 › 蝴蝶」）→ 主題 → 搜尋字 → 外觀
  const scope = activeSub ?? activeGroup
  const scopeSpecies = scope ? speciesList.filter(scope.match) : []
  const groupSpecies = scopeSpecies.filter((s) => matchTags(s, activeTags) && matchSearch(s))
  const filteredSpecies = applyAppearance(groupSpecies)

  // 每個主題「加選之後還剩幾種」：會變成 0 種的不能選（例如特有種＋外來種不可能同時成立）
  // 還沒選分頁（首頁隨機推薦）時，點主題會從「全部」裡篩選，所以用全部物種來計算
  const tagScopeSpecies = scope ? scopeSpecies : speciesList
  const countWithTag = (tagId) => {
    const tags = activeTags.includes(tagId) ? activeTags : [...activeTags, tagId]
    return applyAppearance(tagScopeSpecies.filter((s) => matchTags(s, tags) && matchSearch(s))).length
  }

  return (
    <div className="container">
      <section className={styles.hero}>
        {/* 畫面上的大標題拿掉（頁首已經有網站名稱），但保留給螢幕閱讀器和搜尋引擎：每頁都該有一個 h1 */}
        <h1 className="visually-hidden">發現台灣動物趣</h1>
        <p className={styles.subtitle}>探索台灣的鳥類、哺乳類、爬蟲類、兩棲類、魚類、昆蟲、蜘蛛、蜈蚣與甲殼類</p>
      </section>

      <div className={styles.tabBar}>
        {/* 分頁（單選）：手機可以左右滑動，平板以上會自動換行 */}
        <div className={styles.tabs} role="tablist" aria-label="動物分類">
          {GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={activeGroup?.id === group.id}
              className={styles.tab}
              onClick={() => selectGroup(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>

        {/* 主題＋推薦按鈕同一行：主題靠左，推薦按鈕推到最右邊 */}
        <div className={styles.tagRow}>
          {/* 主題（可複選）：疊加在分頁上，選越多範圍越小 */}
          <div className={styles.tabs} role="group" aria-label="主題（可複選）">
            {COLLECTIONS.map((tag) => {
              const isSelected = activeTags.includes(tag.id)
              const count = status === 'success' ? countWithTag(tag.id) : null
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={isSelected}
                  data-kind="collection"
                  className={styles.tab}
                  title={count === null ? tag.label : `${tag.label}（${count} 種）`}
                  disabled={count === 0 && !isSelected}
                  onClick={() => toggleTag(tag.id)}
                >
                  {/* 打勾：不只靠顏色，也用符號表示「已選取」 */}
                  {isSelected && <span aria-hidden="true">✓ </span>}
                  {tag.label}
                </button>
              )
            })}
          </div>

          {/* 推薦按鈕（重新隨機挑一批）：只在首頁隨機推薦時出現 */}
          {status === 'success' && !activeGroup && (
            <button type="button" className={styles.refresh} onClick={() => setRefreshCount((n) => n + 1)}>
              <span aria-hidden="true">↻</span> 推薦
            </button>
          )}
        </div>
      </div>

      {/* 第二層小分類：選了有小分類的類群（例如昆蟲類）才出現 */}
      {activeGroup?.subgroups && (
        <div ref={subtabsRef} className={styles.subtabs} role="tablist" aria-label={`${activeGroup.label}的小分類`}>
          <span className={styles.subtabsLabel} aria-hidden="true">
            {activeGroup.label} ›
          </span>
          {[{ id: null, label: '全部' }, ...activeGroup.subgroups].map((sub) => (
            <button
              key={sub.id ?? 'all'}
              type="button"
              role="tab"
              aria-selected={(activeSub?.id ?? null) === sub.id}
              className={styles.subtab}
              onClick={() => selectSub(sub.id)}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}

      {/* 選了類群才出現外觀篩選；key 讓切換類群時重新播放出現動畫
          group 用最細的那一層（例如蝴蝶），大小的選項才對得上；
          只選「昆蟲類」時，蝴蝶和蜻蜓的大小標準不同，大小篩選會請使用者先選小分類 */}
      {status === 'success' && showFilters && (
        <FilterPanel
          key={scope.id}
          list={groupSpecies}
          group={scope.id}
          filters={filters}
          onChange={changeFilter}
          onClear={clearFilters}
        />
      )}

      {status === 'loading' && <p className={styles.message}>資料載入中…</p>}
      {status === 'error' && <p className={styles.message}>資料載入失敗，請稍後再試</p>}

      {/* 還沒選分頁：隨機推薦 */}
      {status === 'success' && !activeGroup && (
        <>
          <p className={styles.count}>
            隨機推薦 {randomSpecies.length} 種（全台共 {speciesList.length} 種，點上方分類看更多）
          </p>
          <SpeciesGrid list={randomSpecies} />
        </>
      )}

      {/* 已選分頁 */}
      {status === 'success' && activeGroup && (
        <>
          <p className={styles.count}>
            共 {filteredSpecies.length} 種
            {filteredSpecies.length < scopeSpecies.length && `（從 ${scopeSpecies.length} 種中篩選）`}
          </p>
          {filteredSpecies.length === 0 ? (
            <p className={styles.message}>沒有符合條件的動物，試著減少一些條件</p>
          ) : (
            <SpeciesGrid list={filteredSpecies} />
          )}
        </>
      )}
    </div>
  )
}
