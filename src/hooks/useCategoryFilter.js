import { useState } from 'react'
import { GROUPS } from '../constants/groups.js'
import { withLocalData } from './useSpeciesList.js'

/**
 * 附近動物的類別開關（「我附近的動物」頁、物種詳細頁的「我的位置」共用）
 *
 *   species：iNaturalist 查到的附近物種（每種都有 category，例如 aves、insecta）
 *   observations：附近的觀察紀錄（地圖上的點，也有 category）
 *
 * 回傳：
 *   categories：這附近有出現的類別（依首頁分頁的順序），附上種數
 *   species / observations：關掉的類別已經濾掉
 *   allSpecies：還沒濾掉的物種（用來判斷「是不是全部都被關掉了」）
 */
export function useCategoryFilter(species, observations, speciesList) {
  // 被關掉的類別（記「關掉的」而不是「開著的」：換地點後新出現的類別預設就是開的）
  const [hiddenCategories, setHiddenCategories] = useState([])

  // 若物種已在我們整理好的清單中，改用清單資料（有 TaiCOL 的保育等級等資訊）
  //   清單資料沒有 category 欄位，所以類別要從 iNaturalist 原本的結果取
  const categoryById = new Map(species.map((s) => [s.id, s.category]))
  const allSpecies = withLocalData(species, speciesList).map((s) => ({ ...s, category: categoryById.get(s.id) }))

  const categories = GROUPS.filter((g) => g.kind === 'group')
    .map((g) => ({ ...g, count: allSpecies.filter((s) => s.category === g.id).length }))
    .filter((g) => g.count > 0)

  const isShown = (item) => !hiddenCategories.includes(item.category)
  const toggle = (id) =>
    setHiddenCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))

  return {
    categories,
    hiddenCategories,
    toggle,
    allSpecies,
    species: allSpecies.filter(isShown),
    observations: observations.filter(isShown),
  }
}
