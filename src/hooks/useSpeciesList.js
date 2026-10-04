import { useEffect, useState } from 'react'

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
