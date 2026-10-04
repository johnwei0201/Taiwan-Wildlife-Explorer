import { useEffect, useState } from 'react'

// 即時查詢到的物種若在整理好的清單中，改用清單資料（有 TaiCOL 的官方中文名、保育等級等）
export function withLocalData(species, speciesList) {
  const localById = new Map(speciesList.map((s) => [s.id, s]))
  return species.map((s) => localById.get(s.id) ?? s)
}

// 讀取資料腳本產生的物種清單（首頁、我附近的動物都會用到）
export function useSpeciesList() {
  const [speciesList, setSpeciesList] = useState([])
  const [status, setStatus] = useState('loading') // loading 載入中 / success 成功 / error 失敗

  useEffect(() => {
    fetch('/data/species-list.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setSpeciesList(data)
        setStatus('success')
      })
      .catch(() => setStatus('error'))
  }, [])

  return { speciesList, status }
}
